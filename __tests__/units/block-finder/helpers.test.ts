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
      // Using bounds that contain midnight for Jan 15, 2024
      // Block 40268100 is at Jan 15 23:59:08 UTC (verified)
      // Block 40268500 is at Jan 16 00:01:17 UTC (verified)
      const lowerBound = 40268000;
      const upperBound = 40269000;

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

    it("should throw error when single block bound is before midnight", async () => {
      const date = new Date("2024-01-15");
      // Use a block from the middle of the day (around noon)
      const bound = 40200000; // Block around middle of day

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
      // These bounds are within the day but don't extend to midnight
      // Based on the issue, block 40051000 is at ~2:40 AM on Jan 15
      const lowerBound = 40049000;
      const upperBound = 40051000;

      await expect(
        blockFinder.findEndOfDayBlock(date, lowerBound, upperBound),
      ).rejects.toThrow(/Search bounds do not contain midnight/);
    });

    it("should find end of day block when bounds properly contain midnight", async () => {
      const date = new Date("2024-01-15");
      // Using tight bounds around midnight for Jan 15
      // Block 40268100 is at Jan 15 23:59:08 UTC (verified)
      // Block 40268500 is at Jan 16 00:01:17 UTC (verified)
      const lowerBound = 40268050;
      const upperBound = 40268550;

      const blockNumber = await blockFinder.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );

      // Verify the block is before midnight
      const block = await provider.getBlock(blockNumber);
      const blockTime = new Date(block!.timestamp * 1000);
      const nextMidnight = new Date(date);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);

      expect(blockTime.getTime()).toBeLessThan(nextMidnight.getTime());

      // Verify the next block would be after midnight
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
