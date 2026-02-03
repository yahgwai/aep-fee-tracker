import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../../infrastructure/storage/test-utils";
import {
  createMockedProvider,
  createBlockFinder,
  TEST_BLOCKS,
  getDateRange,
} from "./test-utils";
import { BlockFinder } from "../../../../src/core/block-processing/block-finder";
import { BlockNumberData } from "../../../../src/types";
import { CHAIN_IDS } from "../../../../src/constants";

describe("BlockFinder - findBlocksForDateRange", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = createMockedProvider({
      loadEventData: true,
    });
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

    it("should skip dates that are too recent (less than SAFE_BLOCK_OFFSET blocks old)", async () => {
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

    it("should skip dates when chain has not reached end of day", async () => {
      // Use a block number that's in the middle of 2024-01-15 (before midnight)
      // TEST_BLOCKS["2024-01-15"] = 40268100 is the end-of-day block
      // We use a block ~50000 blocks earlier, which would be ~3.5 hours earlier
      const midDayBlock = TEST_BLOCKS["2024-01-15"] - 50000;

      const customProvider = createMockedProvider({
        currentBlock: midDayBlock + 100, // Add SAFE_BLOCK_OFFSET back
        loadEventData: false,
      });

      const customBlockFinder = createBlockFinder(
        testContext.fileManager,
        customProvider,
      );

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-14": TEST_BLOCKS["2024-01-10"], // Previous day exists
        },
      };
      testContext.fileManager.writeBlockNumbers(existingData);

      const [startDate, endDate] = getDateRange("2024-01-15", "2024-01-15");

      const result = await customBlockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      // The date should be skipped (not in result) because chain hasn't reached midnight
      expect(result.blocks["2024-01-15"]).toBeUndefined();

      await customProvider.destroy();
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
      const badProvider = {
        async getNetwork() {
          return {
            chainId: BigInt(42170),
            name: "arbitrum-nova",
          };
        },
        async getBlockNumber() {
          throw new Error("Network error");
        },
        async getBlock() {
          throw new Error("Network error");
        },
        async destroy() {},
      } as unknown as ethers.JsonRpcProvider;
      const [startDate, endDate] = getDateRange("2022-01-15", "2022-01-16");

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

  describe("getSafeCurrentBlock", () => {
    it("should use SAFE_BLOCK_OFFSET from constants", async () => {
      const { SAFE_BLOCK_OFFSET } = require("../../../../src/constants");

      const currentBlockNumber = 5000;
      jest
        .spyOn(provider, "getBlockNumber")
        .mockResolvedValue(currentBlockNumber);

      const safeBlock = await blockFinder.getSafeCurrentBlock();

      expect(safeBlock).toBe(currentBlockNumber - SAFE_BLOCK_OFFSET);
      expect(SAFE_BLOCK_OFFSET).toBe(100);
    });

    it("should handle RPC errors when getting current block", async () => {
      jest
        .spyOn(provider, "getBlockNumber")
        .mockRejectedValue(new Error("RPC error"));

      await expect(blockFinder.getSafeCurrentBlock()).rejects.toThrow(
        "Failed to get current block number",
      );
    });
  });
});
