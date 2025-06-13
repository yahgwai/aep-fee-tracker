import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createTestDate,
  TestContext,
} from "./test-utils";
import { BlockNumberData, CHAIN_IDS } from "../../../src/types";

// Test constants
const TEST_DATE = createTestDate();
const TEST_BLOCK_NUMBER = 12345678;

// Test data factory functions
function createBlockNumberData(
  overrides?: Partial<BlockNumberData>,
): BlockNumberData {
  return {
    metadata: {
      chain_id: CHAIN_IDS.ARBITRUM_ONE,
    },
    blocks: {},
    ...overrides,
  };
}

describe("FileManager - Block Numbers", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readBlockNumbers()", () => {
    it("should return empty BlockNumberData when block_numbers.json does not exist", () => {
      const result = testContext.fileManager.readBlockNumbers();
      expect(result).toEqual(createBlockNumberData());
    });

    it("should write and read back BlockNumberData with multiple date entries", () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
          "2024-01-17": 12367890,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);
      const result = testContext.fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });

    it("should preserve block number precision for large block numbers", () => {
      const largeBlockNumber = 200000000;
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": largeBlockNumber,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);
      const result = testContext.fileManager.readBlockNumbers();

      expect(result.blocks["2024-01-15"]).toBe(largeBlockNumber);
    });

    it("should format JSON with 2-space indentation for human readability", () => {
      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);

      const fileContent = fs.readFileSync("store/block_numbers.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should maintain date ordering in blocks object", () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-17": 12367890,
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);
      const result = testContext.fileManager.readBlockNumbers();

      const dates = Object.keys(result.blocks);
      expect(dates).toEqual(["2024-01-17", "2024-01-15", "2024-01-16"]);
    });

    it("should handle single date entry correctly", () => {
      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);
      const result = testContext.fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });
  });

  describe("writeBlockNumbers()", () => {
    it("should validate date formats are YYYY-MM-DD", () => {
      const invalidData = createBlockNumberData({
        blocks: {
          "01/15/2024": TEST_BLOCK_NUMBER,
        },
      });

      expect(() =>
        testContext.fileManager.writeBlockNumbers(invalidData),
      ).toThrow(/Invalid date format/);
    });

    it("should ensure block numbers are positive integers", () => {
      const negativeBlockData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: -12345678,
        },
      });

      expect(() =>
        testContext.fileManager.writeBlockNumbers(negativeBlockData),
      ).toThrow(/positive integer/);
    });

    it("should reject zero as block number", () => {
      const zeroBlockData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: 0,
        },
      });

      expect(() =>
        testContext.fileManager.writeBlockNumbers(zeroBlockData),
      ).toThrow(/positive integer/);
    });

    it("should create store directory if it does not exist", () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      testContext.fileManager.writeBlockNumbers(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/block_numbers.json")).toBe(true);
    });

    it("should validate calendar dates not just format", () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-02-30": 12345678, // February 30th doesn't exist
        },
      });

      expect(() => testContext.fileManager.writeBlockNumbers(testData)).toThrow(
        "Invalid calendar date: 2024-02-30",
      );
    });

    it("should validate block numbers are within reasonable range", () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": 2000000000, // Exceeds 1 billion blocks
        },
      });

      expect(() => testContext.fileManager.writeBlockNumbers(testData)).toThrow(
        "Block number exceeds reasonable maximum: 2000000000 (max: 1000000000)",
      );
    });
  });
});
