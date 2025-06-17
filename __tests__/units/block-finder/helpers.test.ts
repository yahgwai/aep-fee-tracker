import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import { BlockNumberData, CHAIN_IDS, FileManager } from "../../../src/types";
import { BlockFinder } from "../../../src/block-finder";

describe("BlockFinder - Helper Functions", () => {
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    const rpcUrl = process.env["RPC_URL"] || "https://nova.arbitrum.io/rpc";
    // Create provider with static network to prevent auto-detection retry loop
    const network = ethers.Network.from({
      chainId: 42170,
      name: "arbitrum-nova",
    });
    provider = new ethers.JsonRpcProvider(rpcUrl, network, {
      staticNetwork: network,
    });
    // Create a dummy file manager since helper methods don't use it
    const dummyFileManager = {} as FileManager;
    blockFinder = new BlockFinder(dummyFileManager, provider);
  });

  afterEach(async () => {
    // Destroy the provider to clean up network connections
    if (provider) {
      await provider.destroy();
    }
  });

  describe("findEndOfDayBlock", () => {
    it("should find the last block before midnight UTC for a specific date", async () => {
      const date = new Date("2024-01-15");
      // Use extremely tight bounds - we know the approximate block
      // This reduces binary search to just a few iterations
      const lowerBound = 40050200; // Very close to actual midnight block
      const upperBound = 40050400; // Just 200 block range

      const blockNumber = await blockFinder.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );

      expect(blockNumber).toBeGreaterThanOrEqual(lowerBound);
      expect(blockNumber).toBeLessThanOrEqual(upperBound);

      // Verify the block is before midnight
      const block = await provider.getBlock(blockNumber);
      const blockTime = new Date(block!.timestamp * 1000);
      const nextMidnight = new Date(date);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);

      expect(blockTime.getTime()).toBeLessThan(nextMidnight.getTime());
    });

    it("should throw error when all blocks in range are after midnight", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 41000000; // Too high - after midnight
      const upperBound = 41100000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are after midnight/);
    });

    it("should throw error when all blocks in range are before the target date", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 100000; // Too low - way before the date
      const upperBound = 200000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are before the target date/);
    });

    it("should handle edge case where lower bound equals upper bound", async () => {
      const date = new Date("2024-01-15");
      const bound = 40050000; // A block number within the valid range

      const blockNumber = await blockFinder.findEndOfDayBlock(
        date,
        bound,
        bound,
      );

      expect(blockNumber).toBe(bound);
    });

    it("should throw error when lower bound is greater than upper bound", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40100000;
      const upperBound = 40000000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/Invalid search bounds/);
    });
  });

  describe("getSafeCurrentBlock", () => {
    it("should return current block number minus 1000", async () => {
      const safeBlock = await blockFinder.getSafeCurrentBlock();
      const currentBlock = await provider.getBlockNumber();

      expect(safeBlock).toBe(currentBlock - 1000);
    });

    it("should throw error when unable to get current block", async () => {
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

      try {
        const badBlockFinder = new BlockFinder({} as FileManager, badProvider);
        await expect(badBlockFinder.getSafeCurrentBlock()).rejects.toThrow(
          /Failed to get current block/,
        );
      } finally {
        // Ensure cleanup even if test fails
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
      const safeCurrentBlock = 200000000; // High enough that 365 days won't reach it

      const [, upper] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      // Should always use safeCurrentBlock as upper bound, even for first date
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

      // Should always use safeCurrentBlock as upper bound
      expect(upper).toBe(safeCurrentBlock);
    });

    it("should cap upper bound at safe current block", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: {
          "2024-01-15": 44999000, // Very close to safe current block
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
          "2024-01-15": 40000000, // Missing 2024-01-16
        },
      };
      const safeCurrentBlock = 45000000;

      const [lower] = blockFinder.getSearchBounds(
        date,
        existingBlocks,
        safeCurrentBlock,
      );

      // Should use last known block as lower bound
      expect(lower).toBe(40000000);
    });
  });
});
