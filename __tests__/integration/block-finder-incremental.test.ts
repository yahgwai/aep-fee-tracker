import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import { BlockFinder } from "../../src/block-finder";
import { CHAIN_IDS } from "../../src/types";

describe("BlockFinder - Incremental Processing Integration Test", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;
  let rpcCallCount: number;
  let originalGetBlock: typeof provider.getBlock;

  const ARBITRUM_NOVA_CHAIN_ID = 42170;
  const ARBITRUM_NOVA_RPC_URL = "https://nova.arbitrum.io/rpc";

  function createProvider(): ethers.JsonRpcProvider {
    const network = ethers.Network.from({
      chainId: ARBITRUM_NOVA_CHAIN_ID,
      name: "arbitrum-nova",
    });
    return new ethers.JsonRpcProvider(ARBITRUM_NOVA_RPC_URL, network, {
      staticNetwork: network,
    });
  }

  function instrumentProviderForCallTracking(
    provider: ethers.JsonRpcProvider,
  ): { getCallCount: () => number; getRequestedBlocks: () => number[] } {
    let callCount = 0;
    const requestedBlocks: number[] = [];
    const original = provider.getBlock.bind(provider);
    provider.getBlock = async function (
      ...args: Parameters<typeof provider.getBlock>
    ) {
      callCount++;
      // Track the block number if it's a numeric request
      const blockTag = args[0];
      if (typeof blockTag === "number") {
        requestedBlocks.push(blockTag);
      }
      return original(...args);
    };
    return {
      getCallCount: () => callCount,
      getRequestedBlocks: () => requestedBlocks,
    };
  }

  beforeEach(() => {
    testContext = setupTestEnvironment();

    // Set up provider with static network config to prevent async leaks
    provider = createProvider();
    blockFinder = new BlockFinder(testContext.fileManager, provider);

    // Track RPC calls by intercepting getBlock method
    const requestedBlocks: number[] = [];
    rpcCallCount = 0;
    originalGetBlock = provider.getBlock.bind(provider);
    provider.getBlock = async function (
      ...args: Parameters<typeof provider.getBlock>
    ) {
      rpcCallCount++;
      // Track the block number if it's a numeric request
      const blockTag = args[0];
      if (typeof blockTag === "number") {
        requestedBlocks.push(blockTag);
      }
      return originalGetBlock(...args);
    };
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    if (provider) {
      await provider.destroy();
    }
  });

  describe("Incremental processing after interruption", () => {
    it("should resume processing after interruption without duplicate RPC calls", async () => {
      // Test data: 5-day range from January 9-13, 2024
      // Using dates from the test data referenced in the issue
      const startDate = new Date("2024-01-09");
      const endDate = new Date("2024-01-13");

      // Phase 1: Start processing and interrupt after 2 days
      // First, we'll process only Jan 9-10 (2 days of the 5-day range)
      const partialEndDate = new Date("2024-01-10");
      const expectedPartialDays = ["2024-01-09", "2024-01-10"];

      console.log("Phase 1: Processing first 2 days (Jan 9-10)...");
      const initialRpcCallCount = rpcCallCount;

      const partialResult = await blockFinder.findBlocksForDateRange(
        startDate,
        partialEndDate,
      );

      // Verify we found blocks for the first 2 days
      expectedPartialDays.forEach((date) => {
        expect(partialResult.blocks).toHaveProperty(date);
        expect(partialResult.blocks[date]).toBeGreaterThan(0);
      });
      expect(Object.keys(partialResult.blocks)).toHaveLength(
        expectedPartialDays.length,
      );

      const rpcCallsForFirstTwoDays = rpcCallCount - initialRpcCallCount;
      console.log(
        `RPC calls made for first 2 days: ${rpcCallsForFirstTwoDays}`,
      );
      expect(rpcCallsForFirstTwoDays).toBeGreaterThan(0);

      // Store the block numbers found for Jan 9-10
      const foundBlocks = {
        "2024-01-09": partialResult.blocks["2024-01-09"],
        "2024-01-10": partialResult.blocks["2024-01-10"],
      };

      // Simulate interruption by creating a new BlockFinder instance
      // This represents the process restarting after a failure
      console.log("Simulating interruption and restart...");

      const newProvider = createProvider();
      const { getCallCount, getRequestedBlocks } =
        instrumentProviderForCallTracking(newProvider);
      const resumedBlockFinder = new BlockFinder(
        testContext.fileManager,
        newProvider,
      );

      // Phase 2: Resume processing for the full date range
      console.log("Phase 2: Resuming for full range (Jan 9-13)...");

      const fullResult = await resumedBlockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

      // Verify we have all 5 days
      const expectedAllDays = [
        "2024-01-09",
        "2024-01-10",
        "2024-01-11",
        "2024-01-12",
        "2024-01-13",
      ];

      expectedAllDays.forEach((date) => {
        expect(fullResult.blocks).toHaveProperty(date);
        expect(fullResult.blocks[date]).toBeGreaterThan(0);
      });
      expect(Object.keys(fullResult.blocks)).toHaveLength(
        expectedAllDays.length,
      );

      // Critical assertion: Verify no duplicate work for already-found blocks
      const resumeRpcCallCount = getCallCount();
      const requestedBlockNumbers = getRequestedBlocks();
      console.log(`RPC calls made during resume: ${resumeRpcCallCount}`);

      // The resumed finder should make RPC calls only for new days
      expect(resumeRpcCallCount).toBeGreaterThan(0);

      // Verify that the block finder is efficiently using previous results
      // When searching for Jan 11-13, it should use Jan 10's block as a lower bound
      const jan10Block = foundBlocks["2024-01-10"];

      // The block finder's getSearchBounds method uses the most recent known block
      // as the lower bound for the next day's search. So when searching for Jan 11,
      // it should start from Jan 10's block (39039698) as the lower bound.
      console.log(`Previously found block for Jan 10: ${jan10Block}`);

      // Count how many blocks were requested at or before Jan 10's end-of-day block
      const blocksBeforeOrAtJan10 = requestedBlockNumbers.filter(
        (block) => block <= jan10Block!,
      );
      const blocksAfterJan10 = requestedBlockNumbers.filter(
        (block) => block > jan10Block!,
      );

      console.log(`Block requests analysis:`);
      console.log(
        `  - Total blocks requested: ${requestedBlockNumbers.length}`,
      );
      console.log(
        `  - Blocks <= Jan 10 end-of-day (${jan10Block}): ${blocksBeforeOrAtJan10.length}`,
      );
      console.log(`  - Blocks > Jan 10 end-of-day: ${blocksAfterJan10.length}`);

      // The binary search for Jan 11 will use Jan 10's block as lower bound,
      // so we expect very few (ideally just 1) request at or below Jan 10's block
      // This would be the initial check of the lower bound
      expect(blocksBeforeOrAtJan10.length).toBeLessThanOrEqual(3);

      // The vast majority of requests should be after Jan 10
      expect(blocksAfterJan10.length).toBeGreaterThan(
        requestedBlockNumbers.length * 0.95,
      );

      // Verify the blocks for Jan 9-10 are the same as before
      // (not re-fetched with potentially different values)
      expectedPartialDays.forEach((date) => {
        expect(fullResult.blocks[date]).toBe(partialResult.blocks[date]);
      });

      // Verify metadata is preserved
      expect(fullResult.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);

      // Clean up
      await newProvider.destroy();
    }, 30000); // Increase timeout for RPC calls
  });
});
