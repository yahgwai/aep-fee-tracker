import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../file-manager/test-utils";
import {
  createProvider,
  createBlockFinder,
  TEST_BLOCKS,
  getDateRange,
  LOCALHOST_RPC,
} from "./test-utils";
import { BlockFinder } from "../../../src/block-finder";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";

describe("BlockFinder - findBlocksForDateRange", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = createProvider();
    blockFinder = createBlockFinder(testContext.fileManager, provider);
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    if (provider) {
      await provider.destroy();
    }
  });

  describe("Input validation", () => {
    it("should throw error when start date is after end date", async () => {
      const [endDate, startDate] = getDateRange("2024-01-15", "2024-01-16");

      await expect(
        blockFinder.findBlocksForDateRange(startDate, endDate),
      ).rejects.toThrow("Start date must not be after end date");
    });

    it("should throw error when dates are not valid Date objects", async () => {
      const invalidDate = "not-a-date" as unknown as Date;
      const validDate = new Date("2024-01-15");

      await expect(
        blockFinder.findBlocksForDateRange(invalidDate, validDate),
      ).rejects.toThrow("Invalid start date provided");

      await expect(
        blockFinder.findBlocksForDateRange(validDate, invalidDate),
      ).rejects.toThrow("Invalid end date provided");
    });

    it("should throw error when Date objects are invalid", async () => {
      const invalidDate = new Date("invalid");
      const validDate = new Date("2024-01-15");

      await expect(
        blockFinder.findBlocksForDateRange(invalidDate, validDate),
      ).rejects.toThrow("Invalid start date provided");
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
      const [startDate, endDate] = getDateRange("2024-01-15", "2024-01-17");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": TEST_BLOCKS["2024-01-15"],
          "2024-01-16": TEST_BLOCKS["2024-01-16"],
          "2024-01-17": TEST_BLOCKS["2024-01-17"],
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
      const [startDate, endDate] = getDateRange("2024-01-11", "2024-01-12");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-10": TEST_BLOCKS["2024-01-10"],
          "2024-01-15": TEST_BLOCKS["2024-01-15"],
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(result.blocks["2024-01-11"]).toBeDefined();
      expect(result.blocks["2024-01-12"]).toBeDefined();
      expect(result.blocks["2024-01-11"]).toBeGreaterThan(
        TEST_BLOCKS["2024-01-10"],
      );
      expect(result.blocks["2024-01-12"]).toBeGreaterThan(
        result.blocks["2024-01-11"]!,
      );
      expect(result.blocks["2024-01-12"]).toBeLessThan(
        TEST_BLOCKS["2024-01-15"],
      );
    }, 30000);

    it("should skip dates that are too recent (less than 1000 blocks old)", async () => {
      const recentDate = new Date();

      jest.spyOn(provider, "getBlockNumber").mockImplementation(async () => {
        return 83667204;
      });

      const result = await blockFinder.findBlocksForDateRange(
        recentDate,
        recentDate,
      );

      expect(
        result.blocks[testContext.fileManager.formatDate(recentDate)],
      ).toBeUndefined();

      (provider.getBlockNumber as jest.Mock).mockRestore();
    });

    it("should persist block numbers after finding them", async () => {
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-10": TEST_BLOCKS["2024-01-10"],
          "2024-01-15": TEST_BLOCKS["2024-01-15"],
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const [startDate, endDate] = getDateRange("2024-01-11", "2024-01-13");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      expect(result.blocks["2024-01-11"]).toBeDefined();
      expect(result.blocks["2024-01-12"]).toBeDefined();
      expect(result.blocks["2024-01-13"]).toBeDefined();
      expect(result.blocks["2024-01-11"]).toBeGreaterThan(
        TEST_BLOCKS["2024-01-10"],
      );
      expect(result.blocks["2024-01-13"]).toBeLessThan(
        TEST_BLOCKS["2024-01-15"],
      );

      const savedData = testContext.fileManager.readBlockNumbers();
      expect(Object.keys(savedData?.blocks || {}).sort()).toEqual([
        "2024-01-10",
        "2024-01-11",
        "2024-01-12",
        "2024-01-13",
        "2024-01-15",
      ]);
      expect(savedData?.blocks["2024-01-10"]).toBe(TEST_BLOCKS["2024-01-10"]);
      expect(savedData?.blocks["2024-01-15"]).toBe(TEST_BLOCKS["2024-01-15"]);
    }, 30000);

    it("should handle date range spanning multiple days", async () => {
      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-09": TEST_BLOCKS["2024-01-09"],
          "2024-01-15": TEST_BLOCKS["2024-01-15"],
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const [startDate, endDate] = getDateRange("2024-01-10", "2024-01-12");

      const result = await blockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

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
      const existingData: BlockNumberData = {
        metadata: {
          chain_id: 999,
        },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await blockFinder.findBlocksForDateRange(
        new Date("2024-01-16"),
        new Date("2024-01-16"),
      );

      expect(result.metadata.chain_id).toBe(999);
    });

    it("should set chain ID from provider when no existing metadata", async () => {
      const result = await blockFinder.findBlocksForDateRange(
        new Date("2024-01-16"),
        new Date("2024-01-16"),
      );

      expect(result.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);
    });
  });

  describe("Error handling", () => {
    it("should throw error with context when RPC provider is not available", async () => {
      const badProvider = createProvider(LOCALHOST_RPC);
      const [startDate, endDate] = getDateRange("2024-01-15", "2024-01-15");

      try {
        const badBlockFinder = createBlockFinder(
          testContext.fileManager,
          badProvider,
        );
        await expect(
          badBlockFinder.findBlocksForDateRange(startDate, endDate),
        ).rejects.toThrow(/Failed to get current block/);
      } finally {
        await badProvider.destroy();
      }
    });

    it("should throw error when unable to find block within bounds", async () => {
      const [startDate, endDate] = getDateRange("2020-01-01", "2020-01-02");

      await expect(
        blockFinder.findBlocksForDateRange(startDate, endDate),
      ).rejects.toThrow(
        /All blocks in range are after midnight|Unable to find block|before the target date/,
      );
    });
  });
});
