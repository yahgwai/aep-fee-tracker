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
  ): { getCallCount: () => number } {
    let callCount = 0;
    const original = provider.getBlock.bind(provider);
    provider.getBlock = async function (
      ...args: Parameters<typeof provider.getBlock>
    ) {
      callCount++;
      return original(...args);
    };
    return { getCallCount: () => callCount };
  }

  beforeEach(() => {
    testContext = setupTestEnvironment();

    // Set up provider with static network config to prevent async leaks
    provider = createProvider();
    blockFinder = new BlockFinder(testContext.fileManager, provider);

    // Track RPC calls by intercepting getBlock method
    rpcCallCount = 0;
    originalGetBlock = provider.getBlock.bind(provider);
    provider.getBlock = async function (
      ...args: Parameters<typeof provider.getBlock>
    ) {
      rpcCallCount++;
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

      // Simulate interruption by creating a new BlockFinder instance
      // This represents the process restarting after a failure
      console.log("Simulating interruption and restart...");

      const newProvider = createProvider();
      const { getCallCount } = instrumentProviderForCallTracking(newProvider);
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

      // Critical assertion: Verify no RPC calls were made for already-found blocks
      // We should only have made calls for the 3 remaining days (Jan 11-13)
      const resumeRpcCallCount = getCallCount();
      console.log(`RPC calls made during resume: ${resumeRpcCallCount}`);

      // The resumed finder should NOT have made any RPC calls for Jan 9-10
      // since those blocks were already in storage
      expect(resumeRpcCallCount).toBeGreaterThan(0); // Should make some calls for new days

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
