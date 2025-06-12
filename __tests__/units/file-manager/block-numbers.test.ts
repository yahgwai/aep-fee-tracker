import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import {
  FileManager as FileManagerInterface,
  BlockNumberData,
  CHAIN_IDS,
} from "../../../src/types";

// Test constants
const TEST_DATE = "2024-01-15";
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

// Test setup helper
function setupFileManager(): FileManagerInterface {
  return new FileManager();
}

describe("FileManager - Block Numbers", () => {
  let tempDir: string;
  let fileManager: FileManagerInterface;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-manager-test-"));
    process.chdir(tempDir);
    fileManager = setupFileManager();
  });

  afterEach(() => {
    process.chdir("/");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("readBlockNumbers()", () => {
    it("should return empty BlockNumberData when block_numbers.json does not exist", async () => {
      const result = await fileManager.readBlockNumbers();
      expect(result).toEqual(createBlockNumberData());
    });

    it("should write and read back BlockNumberData with multiple date entries", async () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
          "2024-01-17": 12367890,
        },
      });

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });

    it("should preserve block number precision for large block numbers", async () => {
      const largeBlockNumber = 200000000;
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": largeBlockNumber,
        },
      });

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result.blocks["2024-01-15"]).toBe(largeBlockNumber);
    });

    it("should format JSON with 2-space indentation for human readability", async () => {
      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      await fileManager.writeBlockNumbers(testData);

      const fileContent = fs.readFileSync("store/block_numbers.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should maintain date ordering in blocks object", async () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-17": 12367890,
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
        },
      });

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      const dates = Object.keys(result.blocks);
      expect(dates).toEqual(["2024-01-17", "2024-01-15", "2024-01-16"]);
    });

    it("should handle single date entry correctly", async () => {
      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });
  });

  describe("writeBlockNumbers()", () => {
    it("should validate date formats are YYYY-MM-DD", async () => {
      const invalidData = createBlockNumberData({
        blocks: {
          "01/15/2024": TEST_BLOCK_NUMBER,
        },
      });

      await expect(fileManager.writeBlockNumbers(invalidData)).rejects.toThrow(
        /Invalid date format/,
      );
    });

    it("should ensure block numbers are positive integers", async () => {
      const negativeBlockData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: -12345678,
        },
      });

      await expect(
        fileManager.writeBlockNumbers(negativeBlockData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should reject zero as block number", async () => {
      const zeroBlockData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: 0,
        },
      });

      await expect(
        fileManager.writeBlockNumbers(zeroBlockData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should create store directory if it does not exist", async () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData = createBlockNumberData({
        blocks: {
          [TEST_DATE]: TEST_BLOCK_NUMBER,
        },
      });

      await fileManager.writeBlockNumbers(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/block_numbers.json")).toBe(true);
    });

    it("should validate calendar dates not just format", async () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-02-30": 12345678, // February 30th doesn't exist
        },
      });

      await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
        "Invalid calendar date: 2024-02-30",
      );
    });

    it("should validate block numbers are within reasonable range", async () => {
      const testData = createBlockNumberData({
        blocks: {
          "2024-01-15": 2000000000, // Exceeds 1 billion blocks
        },
      });

      await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
        "Block number exceeds reasonable maximum: 2000000000 (max: 1000000000)",
      );
    });
  });
});
