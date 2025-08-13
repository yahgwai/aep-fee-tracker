import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import {
  createProvider,
  createBlockFinder,
  instrumentProviderForCallTracking,
  getDateRange,
} from "../units/core/block-processing/test-utils";
import { BlockFinder } from "../../src/core/block-processing/block-finder";
import { CHAIN_IDS } from "../../src/constants";

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

      const newProvider = createProvider();
      const { getCallCount, getRequestedBlocks } =
        instrumentProviderForCallTracking(newProvider);
      const resumedBlockFinder = createBlockFinder(
        testContext.fileManager,
        newProvider,
      );

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

      expect(resumeRpcCallCount).toBeGreaterThan(0);

      const jan10Block = foundBlocks["2024-01-10"];

      const blocksBeforeOrAtJan10 = requestedBlockNumbers.filter(
        (block) => block <= jan10Block!,
      );
      const blocksAfterJan10 = requestedBlockNumbers.filter(
        (block) => block > jan10Block!,
      );

      expect(blocksBeforeOrAtJan10.length).toBe(0);
      expect(blocksAfterJan10.length).toBeGreaterThan(0);

      expectedPartialDays.forEach((date) => {
        expect(fullResult.blocks[date]).toBe(partialResult.blocks[date]);
      });

      expect(fullResult.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);

      await newProvider.destroy();
    }, 60000);
  });
});
