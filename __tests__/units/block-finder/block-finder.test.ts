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
      // Use a single day gap for faster testing
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-16");

      // Pre-seed just the start date with a very recent block
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40049000, // This provides a good lower bound
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(result.blocks["2024-01-15"]).toBe(40049000);
      expect(result.blocks["2024-01-16"]).toBeDefined();
      expect(result.blocks["2024-01-16"]).toBeGreaterThan(40049000);
      // Should find the actual block for 2024-01-16 (not limited by estimation)
      expect(result.blocks["2024-01-16"]).toBeGreaterThan(40400000);
    });

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
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-14": 39700000, // Provides lower bound
          "2024-01-16": 40400000, // Provides upper bound
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const startDate = new Date("2024-01-14");
      const endDate = new Date("2024-01-16");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      // Should have found the missing date
      expect(result.blocks["2024-01-15"]).toBeDefined();
      expect(result.blocks["2024-01-15"]).toBeGreaterThan(39700000);
      expect(result.blocks["2024-01-15"]).toBeLessThan(40400000);

      // Verify all data is persisted
      const savedData = testContext.fileManager.readBlockNumbers();
      expect(Object.keys(savedData.blocks).sort()).toEqual([
        "2024-01-14",
        "2024-01-15",
        "2024-01-16",
      ]);
      expect(savedData.blocks["2024-01-14"]).toBe(39700000);
      expect(savedData.blocks["2024-01-16"]).toBe(40400000);
    }, 15000);

    it("should handle date range spanning multiple days", async () => {
      // Test with just 2 days instead of 3, and pre-seed one
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40049000,
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-16");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(Object.keys(result.blocks).sort()).toEqual([
        "2024-01-15",
        "2024-01-16",
      ]);
      expect(result.blocks["2024-01-16"]!).toBeGreaterThan(
        result.blocks["2024-01-15"]!,
      );
    }, 20000);
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
