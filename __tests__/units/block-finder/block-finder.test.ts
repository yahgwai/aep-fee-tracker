import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../file-manager/test-utils";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";
import { findBlocksForDateRange } from "../../../src/block-finder";

describe("BlockFinder - findBlocksForDateRange", () => {
  let testContext: TestContext;
  let provider: ethers.JsonRpcProvider;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = new ethers.JsonRpcProvider("https://nova.arbitrum.io/rpc");
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("Input validation", () => {
    it("should throw error when start date is after end date", async () => {
      const startDate = new Date("2024-01-16");
      const endDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          startDate,
          endDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Start date must not be after end date");
    });

    it("should throw error when dates are not valid Date objects", async () => {
      const invalidDate = "not-a-date" as unknown as Date;
      const validDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          invalidDate,
          validDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");

      await expect(
        findBlocksForDateRange(
          validDate,
          invalidDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");
    });

    it("should throw error when Date objects are invalid", async () => {
      const invalidDate = new Date("invalid");
      const validDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          invalidDate,
          validDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow("Invalid Date object");
    });
  });

  describe("Date range processing", () => {
    it("should return empty object for empty date range (same start and end date)", async () => {
      const date = new Date("2024-01-15");

      const result = await findBlocksForDateRange(
        date,
        date,
        provider,
        testContext.fileManager,
      );

      expect(result).toEqual({
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {},
      });
    });

    it("should return existing block numbers without making RPC calls", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-17");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 50000000,
          "2024-01-16": 50100000,
          "2024-01-17": 50200000,
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(result).toEqual(existingData);
    });

    it("should find missing blocks for dates not in storage", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-17");

      const existingData: BlockNumberData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
        blocks: {
          "2024-01-15": 50000000,
          "2024-01-17": 50200000,
        },
      };

      testContext.fileManager.writeBlockNumbers(existingData);

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(result.blocks["2024-01-15"]).toBe(50000000);
      expect(result.blocks["2024-01-16"]).toBeGreaterThan(50000000);
      expect(result.blocks["2024-01-16"]).toBeLessThan(50200000);
      expect(result.blocks["2024-01-17"]).toBe(50200000);
    });

    it("should skip dates that are too recent (less than 1000 blocks old)", async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      const result = await findBlocksForDateRange(
        yesterday,
        now,
        provider,
        testContext.fileManager,
      );

      expect(
        result.blocks[testContext.fileManager.formatDate(now)],
      ).toBeUndefined();
    });

    it("should persist block numbers after finding them", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-15");

      await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      const savedData = testContext.fileManager.readBlockNumbers();
      expect(savedData.blocks["2024-01-15"]).toBeDefined();
      expect(savedData.blocks["2024-01-15"]).toBeGreaterThan(0);
    });

    it("should handle date range spanning multiple days", async () => {
      const startDate = new Date("2024-01-10");
      const endDate = new Date("2024-01-12");

      const result = await findBlocksForDateRange(
        startDate,
        endDate,
        provider,
        testContext.fileManager,
      );

      expect(Object.keys(result.blocks)).toContain("2024-01-10");
      expect(Object.keys(result.blocks)).toContain("2024-01-11");
      expect(Object.keys(result.blocks)).toContain("2024-01-12");

      expect(result.blocks["2024-01-11"]!).toBeGreaterThan(
        result.blocks["2024-01-10"]!,
      );
      expect(result.blocks["2024-01-12"]!).toBeGreaterThan(
        result.blocks["2024-01-11"]!,
      );
    });
  });

  describe("Error handling", () => {
    it("should throw error with context when RPC provider is not available", async () => {
      const badProvider = new ethers.JsonRpcProvider("http://localhost:9999");
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-15");

      await expect(
        findBlocksForDateRange(
          startDate,
          endDate,
          badProvider,
          testContext.fileManager,
        ),
      ).rejects.toThrow(/Failed to get current block/);
    });

    it("should throw error when unable to find block within bounds", async () => {
      const startDate = new Date("2020-01-01"); // Before Arbitrum launch
      const endDate = new Date("2020-01-01");

      await expect(
        findBlocksForDateRange(
          startDate,
          endDate,
          provider,
          testContext.fileManager,
        ),
      ).rejects.toThrow(/Unable to find block/);
    });
  });
});
