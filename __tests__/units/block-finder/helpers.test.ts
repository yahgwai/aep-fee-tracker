import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";
import {
  findEndOfDayBlock,
  getSafeCurrentBlock,
  getSearchBounds,
} from "../../../src/block-finder";

describe("BlockFinder - Helper Functions", () => {
  let provider: ethers.JsonRpcProvider;

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
      const lowerBound = 39900000;
      const upperBound = 40100000;

      const blockNumber = await findEndOfDayBlock(
        date,
        provider,
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
        findEndOfDayBlock(date, provider, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are after midnight/);
    });

    it("should throw error when all blocks in range are before the target date", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 100000; // Too low - way before the date
      const upperBound = 200000;

      await expect(
        findEndOfDayBlock(date, provider, lowerBound, upperBound),
      ).rejects.toThrow(/All blocks in range are before the target date/);
    });

    it("should handle edge case where lower bound equals upper bound", async () => {
      const date = new Date("2024-01-15");
      const bound = 40050000; // A block number within the valid range

      const blockNumber = await findEndOfDayBlock(date, provider, bound, bound);

      expect(blockNumber).toBe(bound);
    });

    it("should throw error when lower bound is greater than upper bound", async () => {
      const date = new Date("2024-01-15");
      const lowerBound = 40100000;
      const upperBound = 40000000;

      await expect(
        findEndOfDayBlock(date, provider, lowerBound, upperBound),
      ).rejects.toThrow(/Invalid search bounds/);
    });

    it("should throw error when upper bound is before midnight", async () => {
      const date = new Date("2024-01-15");
      // These bounds are within the day but don't extend to midnight
      // Based on the issue, block 40051000 is at ~2:40 AM on Jan 15
      const lowerBound = 40049000;
      const upperBound = 40051000;

      await expect(
        findEndOfDayBlock(date, provider, lowerBound, upperBound),
      ).rejects.toThrow(/Search bounds do not contain midnight/);
    });

    it("should find end of day block when bounds properly contain midnight", async () => {
      const date = new Date("2024-01-15");
      // Using bounds that we know contain midnight for Jan 15
      // From issue context, we need bounds that extend past midnight
      const lowerBound = 40268000;
      const upperBound = 40269000;

      const blockNumber = await findEndOfDayBlock(
        date,
        provider,
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
      const safeBlock = await getSafeCurrentBlock(provider);
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
        await expect(getSafeCurrentBlock(badProvider)).rejects.toThrow(
          /Failed to get current block/,
        );
      } finally {
        // Ensure cleanup even if test fails
        await badProvider.destroy();
      }
    });

    it("should always return a positive number", async () => {
      const safeBlock = await getSafeCurrentBlock(provider);

      expect(safeBlock).toBeGreaterThan(0);
    });
  });

  describe("getSearchBounds", () => {
    it("should use previous day's block as lower bound when available", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [lower, upper] = getSearchBounds(
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
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {},
      };
      const safeCurrentBlock = 45000000;

      const [lower] = getSearchBounds(date, existingBlocks, safeCurrentBlock);

      expect(lower).toBe(1);
    });

    it("should estimate upper bound based on blocks per day", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 40000000,
        },
      };
      const safeCurrentBlock = 45000000;

      const [, upper] = getSearchBounds(date, existingBlocks, safeCurrentBlock);

      // Arbitrum produces ~4 blocks per second = ~345,600 blocks per day
      // Upper bound should be previous block + estimated blocks per day
      const expectedUpper = 40000000 + 345600;
      expect(upper).toBeGreaterThanOrEqual(expectedUpper - 50000); // Allow some variance
      expect(upper).toBeLessThanOrEqual(expectedUpper + 50000);
    });

    it("should cap upper bound at safe current block", () => {
      const date = new Date("2024-01-16");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 44999000, // Very close to safe current block
        },
      };
      const safeCurrentBlock = 45000000;

      const [, upper] = getSearchBounds(date, existingBlocks, safeCurrentBlock);

      expect(upper).toBe(safeCurrentBlock);
    });

    it("should handle dates with missing previous days", () => {
      const date = new Date("2024-01-17");
      const existingBlocks: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 40000000, // Missing 2024-01-16
        },
      };
      const safeCurrentBlock = 45000000;

      const [lower] = getSearchBounds(date, existingBlocks, safeCurrentBlock);

      // Should use last known block as lower bound
      expect(lower).toBe(40000000);
    });
  });
});
