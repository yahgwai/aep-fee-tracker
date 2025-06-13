import { describe, it, expect, beforeEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  findEndOfDayBlock,
  setProvider,
} from "../../../src/binary-search-block-finder";

describe("findEndOfDayBlock - Binary Search Implementation", () => {
  let provider: ethers.JsonRpcProvider;

  beforeEach(() => {
    const rpcUrl = process.env["RPC_URL"] || "https://arb1.arbitrum.io/rpc";
    provider = new ethers.JsonRpcProvider(rpcUrl);
    setProvider(provider);
  });

  describe("Basic binary search functionality", () => {
    it("should find the last block before midnight UTC", async () => {
      // Using known historical data for Arbitrum One
      // 2024-01-16 00:00:00 UTC
      const targetMidnight = new Date("2024-01-16T00:00:00Z");
      const lowerBound = 170800000;
      const upperBound = 171000000;

      const result = await findEndOfDayBlock(
        targetMidnight,
        lowerBound,
        upperBound,
      );

      expect(result).toBeGreaterThanOrEqual(lowerBound);
      expect(result).toBeLessThan(upperBound);

      // Verify the block is indeed before midnight
      const block = await provider.getBlock(result);
      expect(block).not.toBeNull();
      const blockTimestamp = block!.timestamp * 1000; // Convert to milliseconds
      expect(blockTimestamp).toBeLessThan(targetMidnight.getTime());

      // Verify the next block is at or after midnight
      const nextBlock = await provider.getBlock(result + 1);
      expect(nextBlock).not.toBeNull();
      const nextBlockTimestamp = nextBlock!.timestamp * 1000;
      expect(nextBlockTimestamp).toBeGreaterThanOrEqual(
        targetMidnight.getTime(),
      );
    });
  });

  describe("Edge case: all blocks after midnight", () => {
    it("should return lowerBound - 1 when all blocks are after midnight", async () => {
      // Using a range where all blocks are after the target midnight
      const targetMidnight = new Date("2024-01-16T00:00:00Z");
      const lowerBound = 171000000; // This block is after midnight
      const upperBound = 172000000;

      const result = await findEndOfDayBlock(
        targetMidnight,
        lowerBound,
        upperBound,
      );

      expect(result).toBe(lowerBound - 1);
    });
  });
});
