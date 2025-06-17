import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../file-manager/test-utils";
import { BlockFinder } from "../../../src/block-finder";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";

describe("BlockFinder - findBlocksForDateRange", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    testContext = setupTestEnvironment();

    /**
     * IMPORTANT: JsonRpcProvider Network Configuration
     *
     * We MUST create the provider with explicit static network configuration to prevent
     * async leaks in tests. Here's why:
     *
     * THE PROBLEM:
     * When ethers.js JsonRpcProvider is created without network config, it automatically
     * tries to detect the network by making RPC calls. If these calls fail (network issues,
     * rate limits, or in error tests with invalid URLs), the provider enters a retry loop
     * that logs every second:
     * "JsonRpcProvider failed to detect network and cannot start up; retry in 1s"
     *
     * This causes:
     * 1. "Cannot log after tests are done" errors when retry timers fire after test completion
     * 2. "A worker process has failed to exit gracefully" messages from Jest
     * 3. Test output pollution with error messages from previous tests
     *
     * WHY destroy() WASN'T ENOUGH:
     * Even though we call provider.destroy() in afterEach, there's a race condition:
     * - Network detection starts immediately on provider creation
     * - If the first call fails, a retry is scheduled via setTimeout
     * - destroy() might be called before the retry fires
     * - The retry executes after the test ends, causing the leak
     *
     * THE SOLUTION:
     * By providing static network configuration, we tell the provider to skip network
     * detection entirely. No detection = no retries = no leaks.
     *
     * We still call destroy() in afterEach as a best practice for cleanup, but the
     * static config is what actually prevents the async leaks.
     */
    const network = ethers.Network.from({
      chainId: 42170,
      name: "arbitrum-nova",
    });
    provider = new ethers.JsonRpcProvider(
      "https://nova.arbitrum.io/rpc",
      network,
      { staticNetwork: network },
    );
    blockFinder = new BlockFinder(testContext.fileManager, provider);
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    // Destroy the provider to clean up network connections
    if (provider) {
      await provider.destroy();
    }
  });

  describe("Input validation", () => {
    it("should throw error when start date is after end date", async () => {
      const startDate = new Date("2024-01-16");
      const endDate = new Date("2024-01-15");

      await expect(
        blockFinder.findBlocksForDateRange(startDate, endDate),
      ).rejects.toThrow("Start date must not be after end date");
    });

    it("should throw error when dates are not valid Date objects", async () => {
      const invalidDate = "not-a-date" as unknown as Date;
      const validDate = new Date("2024-01-15");

      await expect(
        blockFinder.findBlocksForDateRange(invalidDate, validDate),
      ).rejects.toThrow("Invalid Date object");

      await expect(
        blockFinder.findBlocksForDateRange(validDate, invalidDate),
      ).rejects.toThrow("Invalid Date object");
    });

    it("should throw error when Date objects are invalid", async () => {
      const invalidDate = new Date("invalid");
      const validDate = new Date("2024-01-15");

      await expect(
        blockFinder.findBlocksForDateRange(invalidDate, validDate),
      ).rejects.toThrow("Invalid Date object");
    });
  });

  describe("Date range processing", () => {
    it("should return empty object for empty date range (same start and end date)", async () => {
      const date = new Date("2024-01-15");

      const result = await blockFinder.findBlocksForDateRange(date, date);

      expect(result).toEqual({
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {},
      });
    });

    it("should return existing block numbers without making RPC calls", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-17");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40000000,
          "2024-01-16": 40345600,
          "2024-01-17": 40691200,
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(result).toEqual(existingData);
    });

    it("should find missing blocks for dates not in storage", async () => {
      // Use a date range where we need to find a missing date
      const startDate = new Date("2024-01-11");
      const endDate = new Date("2024-01-12");

      // Pre-seed with blocks that provide good bounds
      // We have Jan 10 and Jan 15, need to find Jan 11 and Jan 12
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-10": 39039696, // Block from Jan 10 end of day
          "2024-01-15": 40268100, // Block from Jan 15 (provides far upper bound)
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(result.blocks["2024-01-11"]).toBeDefined();
      expect(result.blocks["2024-01-12"]).toBeDefined();
      expect(result.blocks["2024-01-11"]).toBeGreaterThan(39039696);
      expect(result.blocks["2024-01-12"]).toBeGreaterThan(
        result.blocks["2024-01-11"]!,
      );
      expect(result.blocks["2024-01-12"]).toBeLessThan(40268100);
    }, 30000);

    it("should skip dates that are too recent (less than 1000 blocks old)", async () => {
      // Create a date that's definitely recent (within last 1000 blocks)
      const recentDate = new Date();

      // Mock the provider to ensure the date is considered too recent
      jest.spyOn(provider, "getBlockNumber").mockImplementation(async () => {
        // Return a block number that makes our date too recent
        return 83667204;
      });

      const result = await blockFinder.findBlocksForDateRange(
        recentDate,
        recentDate,
      );

      expect(
        result.blocks[testContext.fileManager.formatDate(recentDate)],
      ).toBeUndefined();

      // Restore original method
      (provider.getBlockNumber as jest.Mock).mockRestore();
    });

    it("should persist block numbers after finding them", async () => {
      // Test actual finding and persistence by seeding nearby data
      // Seed with sparse data that has good bounds
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-10": 39039696, // Jan 10 end of day
          "2024-01-15": 40268100, // Jan 15 (provides far upper bound)
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const startDate = new Date("2024-01-11");
      const endDate = new Date("2024-01-13");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      // Should have found the missing dates
      expect(result.blocks["2024-01-11"]).toBeDefined();
      expect(result.blocks["2024-01-12"]).toBeDefined();
      expect(result.blocks["2024-01-13"]).toBeDefined();
      expect(result.blocks["2024-01-11"]).toBeGreaterThan(39039696);
      expect(result.blocks["2024-01-13"]).toBeLessThan(40268100);

      // Verify all data is persisted
      const savedData = testContext.fileManager.readBlockNumbers();
      expect(Object.keys(savedData.blocks).sort()).toEqual([
        "2024-01-10",
        "2024-01-11",
        "2024-01-12",
        "2024-01-13",
        "2024-01-15",
      ]);
      expect(savedData.blocks["2024-01-10"]).toBe(39039696);
      expect(savedData.blocks["2024-01-15"]).toBe(40268100);
    }, 30000);

    it("should handle date range spanning multiple days", async () => {
      // Test with 3 days, using strategic bounds
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-09": 38827575, // Jan 9/10 boundary (provides good lower bound)
          "2024-01-15": 40268100, // Jan 15 (provides upper bound for all dates)
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const startDate = new Date("2024-01-10");
      const endDate = new Date("2024-01-12");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      // Result includes pre-seeded blocks plus the found blocks
      expect(Object.keys(result.blocks).sort()).toEqual([
        "2024-01-09",
        "2024-01-10",
        "2024-01-11",
        "2024-01-12",
        "2024-01-15",
      ]);
      expect(result.blocks["2024-01-11"]!).toBeGreaterThan(
        result.blocks["2024-01-10"]!,
      );
      expect(result.blocks["2024-01-11"]!).toBeLessThan(
        result.blocks["2024-01-12"]!,
      );
    }, 30000);
  });

  describe("Metadata handling", () => {
    it("should preserve existing metadata when initializing result", async () => {
      // Arrange: Create existing data with custom metadata
      const existingData: BlockNumberData = {
        metadata: {
          chain_id: 999, // Different from the provider's chain ID
        },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      // Act: Call findBlocksForDateRange which internally uses initializeResult
      const result = await blockFinder.findBlocksForDateRange(
        new Date("2024-01-16"),
        new Date("2024-01-16"),
      );

      // Assert: The metadata should be preserved
      expect(result.metadata.chain_id).toBe(999);
    });

    it("should set chain ID from provider when no existing metadata", async () => {
      // Arrange: No existing data (empty file)

      // Act: Call findBlocksForDateRange which internally uses initializeResult
      const result = await blockFinder.findBlocksForDateRange(
        new Date("2024-01-16"),
        new Date("2024-01-16"),
      );

      // Assert: The metadata should be set from provider
      expect(result.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);
    });
  });

  describe("Error handling", () => {
    it("should throw error with context when RPC provider is not available", async () => {
      // Create provider with explicit network to prevent retry loop
      const network = ethers.Network.from({
        chainId: 42170,
        name: "arbitrum-nova",
      });
      const badProvider = new ethers.JsonRpcProvider(
        "http://localhost:9999",
        network,
        { staticNetwork: network },
      );
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-15");

      try {
        const badBlockFinder = new BlockFinder(
          testContext.fileManager,
          badProvider,
        );
        await expect(
          badBlockFinder.findBlocksForDateRange(startDate, endDate),
        ).rejects.toThrow(/Failed to get current block/);
      } finally {
        // Ensure cleanup even if test fails
        await badProvider.destroy();
      }
    });

    it("should throw error when unable to find block within bounds", async () => {
      const startDate = new Date("2020-01-01"); // Before Arbitrum Nova launch
      const endDate = new Date("2020-01-02");

      await expect(
        blockFinder.findBlocksForDateRange(startDate, endDate),
      ).rejects.toThrow(
        /All blocks in range are after midnight|Unable to find block|before the target date/,
      );
    });
  });
});
