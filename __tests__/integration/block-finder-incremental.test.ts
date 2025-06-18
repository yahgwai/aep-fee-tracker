import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import {
  createProvider,
  createBlockFinder,
  instrumentProviderForCallTracking,
  getDateRange,
} from "../units/block-finder/test-utils";
import { BlockFinder } from "../../src/block-finder";
import { CHAIN_IDS } from "../../src/types";

describe("BlockFinder - Incremental Processing Integration Test", () => {
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

  describe("Incremental processing after interruption", () => {
    it("should resume processing after interruption without duplicate RPC calls", async () => {
      const [startDate, endDate] = getDateRange("2024-01-09", "2024-01-13");
      const expectedPartialDays = ["2024-01-09", "2024-01-10"];

      console.log("Phase 1: Processing first 2 days (Jan 9-10)...");
      const partialEndDate = new Date("2024-01-10");

      const partialResult = await blockFinder.findBlocksForDateRange(
        startDate,
        partialEndDate,
      );

      expectedPartialDays.forEach((date) => {
        expect(partialResult.blocks).toHaveProperty(date);
        expect(partialResult.blocks[date]).toBeGreaterThan(0);
      });
      expect(Object.keys(partialResult.blocks)).toHaveLength(
        expectedPartialDays.length,
      );

      const foundBlocks = {
        "2024-01-09": partialResult.blocks["2024-01-09"],
        "2024-01-10": partialResult.blocks["2024-01-10"],
      };

      console.log("Simulating interruption and restart...");

      const newProvider = createProvider();
      const { getCallCount, getRequestedBlocks } =
        instrumentProviderForCallTracking(newProvider);
      const resumedBlockFinder = createBlockFinder(
        testContext.fileManager,
        newProvider,
      );

      console.log("Phase 2: Resuming for full range (Jan 9-13)...");

      const fullResult = await resumedBlockFinder.findBlocksForDateRange(
        startDate,
        endDate,
      );

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

      const resumeRpcCallCount = getCallCount();
      const requestedBlockNumbers = getRequestedBlocks();
      console.log(`RPC calls made during resume: ${resumeRpcCallCount}`);

      expect(resumeRpcCallCount).toBeGreaterThan(0);

      const jan10Block = foundBlocks["2024-01-10"];
      console.log(`Previously found block for Jan 10: ${jan10Block}`);

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
      if (blocksBeforeOrAtJan10.length > 0) {
        console.log(
          `  - Specific blocks at/before Jan 10: ${blocksBeforeOrAtJan10.join(", ")}`,
        );
      }
      console.log(`  - Blocks > Jan 10 end-of-day: ${blocksAfterJan10.length}`);

      // After optimization, we should not see any requests for blocks at or before Jan 10
      expect(blocksBeforeOrAtJan10.length).toBe(0);

      expectedPartialDays.forEach((date) => {
        expect(fullResult.blocks[date]).toBe(partialResult.blocks[date]);
      });

      expect(fullResult.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);

      await newProvider.destroy();
    }, 30000);
  });
});
