import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import { BlockNumberData, CHAIN_IDS, FileManager } from "../../../src/types";
import { BlockFinder } from "../../../src/block-finder";
import {
  createProvider,
  createBlockFinderWithMockFileManager,
  LOCALHOST_RPC,
} from "./test-utils";

describe("BlockFinder - Helper Functions", () => {
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    provider = createProvider();
    blockFinder = createBlockFinderWithMockFileManager(provider);
  });

  afterEach(async () => {
    if (provider) {
      await provider.destroy();
    }
  });

  describe("findEndOfDayBlock", () => {
    it("should find the last block before midnight UTC for a specific date", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40268000;
      const upperBound = 40269000;

      const blockNumber = await blockFinder.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );

      expect(blockNumber).toBeGreaterThanOrEqual(lowerBound);
      expect(blockNumber).toBeLessThanOrEqual(upperBound);

      const block = await provider.getBlock(blockNumber);
      const blockTime = new Date(block!.timestamp * 1000);
      const nextMidnight = new Date(date);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);

      expect(blockTime.getTime()).toBeLessThan(nextMidnight.getTime());
    });

    it("should throw error when all blocks in range are after midnight", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 41000000;
      const upperBound = 41100000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are after midnight/);
    });

    it("should throw error when all blocks in range are before the target date", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 100000;
      const upperBound = 200000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are before the target date/);
    });

    it("should throw error when single block bound is before midnight", async () => {
      const date = new Date("2024-01-15");
      const bound = 40200000;

      await expect(
        blockFinder.findEndOfDayBlock(date, bound, bound),
      ).rejects.toThrow(/Search bounds do not contain midnight/);
    });

    it("should throw error when lower bound is greater than upper bound", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40100000;
      const upperBound = 40000000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/Invalid search bounds/);
    });

    it("should throw error when upper bound is before midnight", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40049000;
      const upperBound = 40051000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/Search bounds do not contain midnight/);
    });

    it("should find end of day block when bounds properly contain midnight", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40268050;
      const upperBound = 40268550;

      const blockNumber = await blockFinder.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );

      const block = await provider.getBlock(blockNumber);
      const blockTime = new Date(block!.timestamp * 1000);
      const nextMidnight = new Date(date);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);

      expect(blockTime.getTime()).toBeLessThan(nextMidnight.getTime());

      const nextBlock = await provider.getBlock(blockNumber + 1);
      if (nextBlock) {
        const nextBlockTime = new Date(nextBlock.timestamp * 1000);
        expect(nextBlockTime.getTime()).toBeGreaterThanOrEqual(
          nextMidnight.getTime(),
        );
      }
    });
  });

  describe("getSafeCurrentBlock", () => {
    it("should return current block number minus 1000", async () => {
      const safeBlock = await blockFinder.getSafeCurrentBlock();
      const currentBlock = await provider.getBlockNumber();

      expect(safeBlock).toBe(currentBlock - 1000);
    });

    it("should throw error when unable to get current block", async () => {
      const badProvider = createProvider(LOCALHOST_RPC);

      try {
        const badBlockFinder = new BlockFinder({} as FileManager, badProvider);
        await expect(badBlockFinder.getSafeCurrentBlock()).rejects.toThrow(
          /Failed to get current block/,
        );
      } finally {
        await badProvider.destroy();
      }
    });

    it("should always return a positive number", async () => {
      const safeBlock = await blockFinder.getSafeCurrentBlock();

      expect(safeBlock).toBeGreaterThan(0);
    });
  });

  describe("getSearchBounds", () => {
    it("should use previous day's block as lower bound when available", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [lower, upper] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(lower).toBe(40000000);
      expect(upper).toBeLessThanOrEqual(safeCurrentBlock);
    });

    it("should use 1 as lower bound for first date", () => {
      const date = new Date("2024-01-15");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {},
      };
      const safeCurrentBlock = 45000000;

      const [lower] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(lower).toBe(1);
    });

    it("should always use safe current block as upper bound for first date", () => {
      const date = new Date("2024-01-15");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {},
      };
      const safeCurrentBlock = 200000000;

      const [, upper] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(upper).toBe(safeCurrentBlock);
    });

    it("should always use safe current block as upper bound when lower bound exists", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [, upper] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(upper).toBe(safeCurrentBlock);
    });

    it("should cap upper bound at safe current block", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 44999000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [, upper] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(upper).toBe(safeCurrentBlock);
    });

    it("should handle dates with missing previous days", () => {
      const date = new Date("2024-01-17");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [lower] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      expect(lower).toBe(40000000);
    });
  });
});
