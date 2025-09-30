import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import {
  createBlockFinder,
  getDateRange,
  createMockedProvider,
} from "../units/core/block-processing/test-utils";
import { CHAIN_IDS } from "../../src/constants";

describe("BlockFinder - Incremental Processing Integration Test", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("Incremental processing after interruption", () => {
    it("should resume processing after interruption without duplicate RPC calls", async () => {
      const [startDate, endDate] = getDateRange("2024-01-09", "2024-01-13");
      const expectedPartialDays = ["2024-01-09", "2024-01-10"];
      const partialEndDate = new Date("2024-01-10");

      // Phase 1: Initial run with first mock provider
      const firstProvider = createMockedProvider();
      const blockFinder = createBlockFinder(
        testContext.fileManager,
        firstProvider,
      );

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

      // Phase 2: Resume with new mock provider that tracks calls
      const resumedProvider = createMockedProvider();
      const resumedBlockFinder = createBlockFinder(
        testContext.fileManager,
        resumedProvider,
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

      // Verify incremental behavior - no re-fetching of already found blocks
      const resumeRpcCallCount = resumedProvider._getCallCount();

      expect(resumeRpcCallCount).toBeGreaterThan(0);

      const jan10Block = foundBlocks["2024-01-10"];

      // Should not request any blocks at or before Jan 10 since they're cached
      const blocksBeforeOrAtJan10 = resumedProvider._getBlocksRequestedInRange(
        1,
        jan10Block!,
      );
      expect(blocksBeforeOrAtJan10.length).toBe(0);

      // Should only request blocks for the new dates (Jan 11-13)
      const blocksAfterJan10 = resumedProvider._getBlocksRequestedAfter(
        jan10Block!,
      );
      expect(blocksAfterJan10.length).toBeGreaterThan(0);

      // Verify the cached blocks were not modified
      expectedPartialDays.forEach((date) => {
        expect(fullResult.blocks[date]).toBe(partialResult.blocks[date]);
      });

      expect(fullResult.metadata.chain_id).toBe(CHAIN_IDS.ARBITRUM_NOVA);

      await firstProvider.destroy();
      await resumedProvider.destroy();
    });
  });
});
