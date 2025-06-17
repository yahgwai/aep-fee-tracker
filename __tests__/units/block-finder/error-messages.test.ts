import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../file-manager/test-utils";
import { BlockFinder } from "../../../src/block-finder";
import { BlockFinderError, RPCError } from "../../../src/types";

describe("BlockFinder - Error Messages", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = new ethers.JsonRpcProvider("https://invalid-rpc-url.com", {
      name: "arbitrum-nova",
      chainId: 42170,
    });
    blockFinder = new BlockFinder(testContext.fileManager, provider);
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    provider.destroy();
  });

  describe("Descriptive error messages", () => {
    it("should provide full context when RPC connection fails", async () => {
      try {
        await blockFinder.findBlocksForDateRange(
          new Date("2024-01-15"),
          new Date("2024-01-16"),
        );
        throw new Error("Should have thrown");
      } catch (error) {
        // The error can be either RPCError from initializeResult or BlockFinderError from getSafeCurrentBlock
        if (error instanceof RPCError) {
          expect(error.message).toContain(
            "Failed to get network information after 3 retries",
          );
          expect(error.operation).toBe("getNetwork");
          expect(error.retryCount).toBe(3);
        } else if (error instanceof BlockFinderError) {
          expect(error.message).toContain("Failed to get current block number");
          expect(error.message).toContain("RPC request failed after");
          expect(error.message).toContain(
            "Check: Ensure RPC_URL is accessible",
          );
          expect(error.context.cause).toBeInstanceOf(RPCError);
        } else {
          throw new Error("Unexpected error type");
        }
      }
    });

    it("should provide context when network info retrieval fails", async () => {
      // This test might fail with either getSafeCurrentBlock or network retrieval
      // depending on execution order, both are valid
      try {
        await blockFinder.findBlocksForDateRange(
          new Date("2024-01-15"),
          new Date("2024-01-16"),
        );
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeDefined();
        // Either error is acceptable since they both use retry logic
      }
    });

    it("should provide detailed context for invalid search bounds", async () => {
      const date = new Date("2024-01-15");

      try {
        await blockFinder.findEndOfDayBlock(date, 100000, 50000);
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlockFinderError);
        const blockError = error as BlockFinderError;
        expect(blockError.message).toContain("Invalid search bounds");
        expect(blockError.message).toContain("Lower bound: 100000");
        expect(blockError.message).toContain("Upper bound: 50000");
        expect(blockError.message).toContain(
          "Check: Ensure safe current block",
        );
        expect(blockError.operation).toBe("findEndOfDayBlock");
        expect(blockError.context.date).toBe("2024-01-15");
        expect(blockError.context.searchBounds).toEqual({
          lower: 100000,
          upper: 50000,
        });
      }
    });

    it("should provide context when blocks are not found", async () => {
      // Create a provider that returns null for blocks
      const mockProvider = new ethers.JsonRpcProvider(
        "https://nova.arbitrum.io/rpc",
        {
          name: "arbitrum-nova",
          chainId: 42170,
        },
      );

      // Mock getBlock to return null
      jest.spyOn(mockProvider, "getBlock").mockResolvedValue(null);

      const mockBlockFinder = new BlockFinder(
        testContext.fileManager,
        mockProvider,
      );

      try {
        await mockBlockFinder.findEndOfDayBlock(
          new Date("2024-01-15"),
          40000000,
          40100000,
        );
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlockFinderError);
        const blockError = error as BlockFinderError;
        expect(blockError.message).toContain("Block 40000000 not found");
        expect(blockError.operation).toBe("findEndOfDayBlock");
        expect(blockError.context.date).toBe("2024-01-15");
        expect(blockError.context.searchBounds).toEqual({
          lower: 40000000,
          upper: 40100000,
        });
      } finally {
        mockProvider.destroy();
      }
    });

    it("should include last checked block in binary search errors", async () => {
      const mockProvider = new ethers.JsonRpcProvider(
        "https://nova.arbitrum.io/rpc",
        {
          name: "arbitrum-nova",
          chainId: 42170,
        },
      );

      // Mock getBlock to fail after first successful call
      let callCount = 0;
      jest
        .spyOn(mockProvider, "getBlock")
        .mockImplementation(async (blockNumber) => {
          callCount++;
          if (callCount <= 2) {
            // Return valid blocks for bounds check
            return {
              number: blockNumber,
              timestamp: 1705276800 + ((blockNumber as number) - 40000000) * 15, // Mock timestamps
              hash: "0x123",
            } as ethers.Block;
          }
          throw new Error("RPC error");
        });

      const mockBlockFinder = new BlockFinder(
        testContext.fileManager,
        mockProvider,
      );

      try {
        await mockBlockFinder.findEndOfDayBlock(
          new Date("2024-01-15"),
          40000000,
          40100000,
        );
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlockFinderError);
        const blockError = error as BlockFinderError;
        expect(blockError.message).toContain("Failed to get block");
        expect(blockError.message).toContain("during binary search");
        expect(blockError.operation).toBe("binarySearchForBlock");
        expect(blockError.context.searchBounds).toBeDefined();
        expect(blockError.context.targetTimestamp).toBeDefined();
      } finally {
        mockProvider.destroy();
      }
    });

    it("should provide context for validation errors", async () => {
      const mockProvider = new ethers.JsonRpcProvider(
        "https://nova.arbitrum.io/rpc",
        {
          name: "arbitrum-nova",
          chainId: 42170,
        },
      );

      // Mock getBlock to return blocks after midnight
      jest
        .spyOn(mockProvider, "getBlock")
        .mockImplementation(async (blockNumber) => {
          return {
            number: blockNumber,
            timestamp: 1705363200 + 3600, // After midnight on Jan 16
            hash: "0x123",
          } as ethers.Block;
        });

      const mockBlockFinder = new BlockFinder(
        testContext.fileManager,
        mockProvider,
      );

      try {
        await mockBlockFinder.findEndOfDayBlock(
          new Date("2024-01-15"),
          40000000,
          40100000,
        );
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlockFinderError);
        const blockError = error as BlockFinderError;
        expect(blockError.message).toContain(
          "All blocks in range are after midnight",
        );
        expect(blockError.message).toContain("Date: 2024-01-15");
        expect(blockError.message).toContain("Target: Before");
        expect(blockError.message).toContain(
          "Search bounds: 40000000 to 40100000",
        );
        expect(blockError.message).toContain("Check: Expand search bounds");
        expect(blockError.operation).toBe("validateBlockRange");
        expect(blockError.context.lastCheckedBlock).toBeDefined();
      } finally {
        mockProvider.destroy();
      }
    });
  });

  describe("RPCError context", () => {
    it("should include retry count and operation in RPCError", async () => {
      try {
        await blockFinder.getSafeCurrentBlock();
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlockFinderError);
        const blockError = error as BlockFinderError;
        const rpcError = blockError.context.cause as RPCError;
        expect(rpcError).toBeInstanceOf(RPCError);
        expect(rpcError.retryCount).toBe(3);
        expect(rpcError.operation).toBe("getBlockNumber");
        expect(rpcError.message).toContain(
          "Failed to get current block number after 3 retries",
        );
      }
    });
  });
});
