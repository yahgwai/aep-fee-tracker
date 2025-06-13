import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../file-manager/test-utils";
import { findBlocksForDateRange } from "../../../src/block-finder";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";

describe("BlockFinder - findBlocksForDateRange", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;

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
        findBlocksForDateRange(
          startDate,
          endDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Start date must not be after end date");
    });

    it("should throw error when dates are not valid Date objects", async () => {
      const invalidDate = "not-a-date" as unknown as Date;
      const validDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          invalidDate,
          validDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");

      await expect(
        findBlocksForDateRange(
          validDate,
          invalidDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");
    });

    it("should throw error when Date objects are invalid", async () => {
      const invalidDate = new Date("invalid");
      const validDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          invalidDate,
          validDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");
    });
  });

  describe("Date range processing", () => {
    it("should return empty object for empty date range (same start and end date)", async () => {
      const date = new Date("2024-01-15");

      const result = await findBlocksForDateRange(
        date,
        date,
        provider,
        testContext.fileManager,
      );

      expect(result).toEqual({
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {},
      });
    });

    it("should return existing block numbers without making RPC calls", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-17");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 40000000,
          "2024-01-16": 40345600,
          "2024-01-17": 40691200,
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(result).toEqual(existingData);
    });

    it("should find missing blocks for dates not in storage", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-17");

      // Pre-seed surrounding dates to provide tighter bounds for binary search
      // This reduces the search space when finding the missing middle date
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 40000000,
          "2024-01-17": 40691200,
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(result.blocks["2024-01-15"]).toBe(40000000);
      expect(result.blocks["2024-01-16"]).toBeGreaterThan(40000000);
      expect(result.blocks["2024-01-16"]).toBeLessThan(40691200);
      expect(result.blocks["2024-01-17"]).toBe(40691200);
    });

    it("should skip dates that are too recent (less than 1000 blocks old)", async () => {
      // Create a date that's definitely recent (within last 1000 blocks)
      const recentDate = new Date();

      // Mock the provider to ensure the date is considered too recent
      jest.spyOn(provider, "getBlockNumber").mockImplementation(async () => {
        // Return a block number that makes our date too recent
        return 83667204;
      });

      const result = await findBlocksForDateRange(
        recentDate,
        recentDate,
        provider,
        testContext.fileManager,
      );

      expect(
        result.blocks[testContext.fileManager.formatDate(recentDate)],
      ).toBeUndefined();

      // Restore original method
      (provider.getBlockNumber as jest.Mock).mockRestore();
    });

    it("should persist block numbers after finding them", async () => {
      // Pre-seed most data to minimize RPC calls
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-13": 39350000,
          "2024-01-14": 39700000,
          "2024-01-16": 40400000, // Skip 2024-01-15 to test finding and persistence
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const startDate = new Date("2024-01-14");
      const endDate = new Date("2024-01-16");

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      // Check if anything was found
      expect(Object.keys(result.blocks).length).toBe(4); // Should have all 4 dates

      const savedData = testContext.fileManager.readBlockNumbers();
      expect(savedData.blocks["2024-01-15"]).toBeDefined();
      expect(savedData.blocks["2024-01-15"]).toBeGreaterThan(39700000);
      expect(savedData.blocks["2024-01-15"]).toBeLessThan(40400000);
      // Verify all data is persisted
      expect(savedData.blocks["2024-01-13"]).toBe(39350000);
      expect(savedData.blocks["2024-01-14"]).toBe(39700000);
      expect(savedData.blocks["2024-01-16"]).toBe(40400000);
    }, 15000);

    it("should handle date range spanning multiple days", async () => {
      // Pre-seed data for faster test execution
      // Using known block numbers from Arbitrum Nova to avoid RPC calls for already-known data
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-10": 38784000,
          "2024-01-11": 39129600,
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      // Only need to find one missing day now
      const startDate = new Date("2024-01-10");
      const endDate = new Date("2024-01-12");

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(Object.keys(result.blocks)).toContain("2024-01-10");
      expect(Object.keys(result.blocks)).toContain("2024-01-11");
      expect(Object.keys(result.blocks)).toContain("2024-01-12");

      expect(result.blocks["2024-01-11"]!).toBeGreaterThan(
        result.blocks["2024-01-10"]!,
      );
      expect(result.blocks["2024-01-12"]!).toBeGreaterThan(
        result.blocks["2024-01-11"]!,
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
        await expect(
          findBlocksForDateRange(
            startDate,
            endDate,
            badProvider,
            testContext.fileManager,
          ),
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
        findBlocksForDateRange(
          startDate,
          endDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow(
        /All blocks in range are after midnight|Unable to find block|before the target date/,
      );
    });
  });
});
