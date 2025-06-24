import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "./test-utils";
import { FeeReport, CHAIN_IDS } from "../../../src/types";

// Test constants
const TEST_DATE = "2024-01-10";
const TEST_DISTRIBUTOR_ADDRESS = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";

// Test data factory function
function createFeeReport(overrides?: Partial<FeeReport>): FeeReport {
  return {
    metadata: {
      chain_id: CHAIN_IDS.ARBITRUM_NOVA,
    },
    distributors: {
      [TEST_DISTRIBUTOR_ADDRESS]: [
        {
          date: TEST_DATE,
          start_balance_wei: "1000000000000000000",
          end_balance_wei: "1500000000000000000",
          balance_change_wei: "500000000000000000",
          distributions_wei: "200000000000000000",
          distributions_count: 5,
          total_wei: "700000000000000000",
        },
      ],
    },
    ...overrides,
  };
}

describe("FileManager - Fee Report", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeFeeReport()", () => {
    it("should write fee report data to fee_report.json", () => {
      const testData = createFeeReport();

      // This should fail because writeFeeReport doesn't exist yet
      testContext.fileManager.writeFeeReport(testData);

      // Verify the file was created
      const filePath = path.join(
        testContext.tempDir,
        "store",
        "fee_report.json",
      );
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify the content
      const savedData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(savedData).toEqual(testData);
    });

    it("should overwrite existing fee report file", () => {
      const initialData = createFeeReport();
      const updatedData = createFeeReport({
        distributors: {
          [TEST_DISTRIBUTOR_ADDRESS]: [
            {
              date: "2024-01-11",
              start_balance_wei: "2000000000000000000",
              end_balance_wei: "2500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "300000000000000000",
              distributions_count: 8,
              total_wei: "800000000000000000",
            },
          ],
        },
      });

      // Write initial data
      testContext.fileManager.writeFeeReport(initialData);

      // Write updated data
      testContext.fileManager.writeFeeReport(updatedData);

      // Verify the file contains updated data
      const filePath = path.join(
        testContext.tempDir,
        "store",
        "fee_report.json",
      );
      const savedData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(savedData).toEqual(updatedData);
    });

    it("should use atomic write pattern", () => {
      const testData = createFeeReport();
      const filePath = path.join(
        testContext.tempDir,
        "store",
        "fee_report.json",
      );
      const tempPath = `${filePath}.tmp`;

      // Write the data
      testContext.fileManager.writeFeeReport(testData);

      // Verify the temp file doesn't exist (it should have been renamed)
      expect(fs.existsSync(tempPath)).toBe(false);

      // Verify the final file exists with correct content
      expect(fs.existsSync(filePath)).toBe(true);
      const savedData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(savedData).toEqual(testData);
    });
  });

  describe("writeFeeReport() - validation", () => {
    it("should throw error for invalid date format", () => {
      const invalidData = createFeeReport({
        distributors: {
          [TEST_DISTRIBUTOR_ADDRESS]: [
            {
              date: "2024/01/10", // Invalid format
              start_balance_wei: "1000000000000000000",
              end_balance_wei: "1500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "200000000000000000",
              distributions_count: 5,
              total_wei: "700000000000000000",
            },
          ],
        },
      });

      expect(() => {
        testContext.fileManager.writeFeeReport(invalidData);
      }).toThrow("Invalid date format");
    });

    it("should throw error for invalid wei values", () => {
      const invalidData = createFeeReport({
        distributors: {
          [TEST_DISTRIBUTOR_ADDRESS]: [
            {
              date: TEST_DATE,
              start_balance_wei: "1.5e18", // Scientific notation not allowed
              end_balance_wei: "1500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "200000000000000000",
              distributions_count: 5,
              total_wei: "700000000000000000",
            },
          ],
        },
      });

      expect(() => {
        testContext.fileManager.writeFeeReport(invalidData);
      }).toThrow("Invalid numeric format");
    });

    it("should throw error for negative distributions count", () => {
      const invalidData = createFeeReport({
        distributors: {
          [TEST_DISTRIBUTOR_ADDRESS]: [
            {
              date: TEST_DATE,
              start_balance_wei: "1000000000000000000",
              end_balance_wei: "1500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "200000000000000000",
              distributions_count: -5, // Negative count
              total_wei: "700000000000000000",
            },
          ],
        },
      });

      expect(() => {
        testContext.fileManager.writeFeeReport(invalidData);
      }).toThrow("distributions_count must be a non-negative integer");
    });

    it("should throw error for non-checksummed distributor address", () => {
      const invalidData = createFeeReport({
        distributors: {
          // Lowercase address
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9": [
            {
              date: TEST_DATE,
              start_balance_wei: "1000000000000000000",
              end_balance_wei: "1500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "200000000000000000",
              distributions_count: 5,
              total_wei: "700000000000000000",
            },
          ],
        },
      });

      expect(() => {
        testContext.fileManager.writeFeeReport(invalidData);
      }).toThrow("Distributor address must be checksummed");
    });
  });

  describe("readFeeReport()", () => {
    it("should return undefined when fee_report.json does not exist", () => {
      const result = testContext.fileManager.readFeeReport();
      expect(result).toBeUndefined();
    });

    it("should read and return fee report data", () => {
      const testData = createFeeReport();

      // Write data first
      testContext.fileManager.writeFeeReport(testData);

      // Read it back
      const result = testContext.fileManager.readFeeReport();
      expect(result).toEqual(testData);
    });

    it("should handle multiple distributors and multiple date entries", () => {
      const secondDistributor = "0x1111111111111111111111111111111111111111";
      const testData = createFeeReport({
        distributors: {
          [TEST_DISTRIBUTOR_ADDRESS]: [
            {
              date: "2024-01-10",
              start_balance_wei: "1000000000000000000",
              end_balance_wei: "1500000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "200000000000000000",
              distributions_count: 5,
              total_wei: "700000000000000000",
            },
            {
              date: "2024-01-11",
              start_balance_wei: "1500000000000000000",
              end_balance_wei: "2000000000000000000",
              balance_change_wei: "500000000000000000",
              distributions_wei: "300000000000000000",
              distributions_count: 7,
              total_wei: "800000000000000000",
            },
          ],
          [secondDistributor]: [
            {
              date: "2024-01-10",
              start_balance_wei: "5000000000000000000",
              end_balance_wei: "6000000000000000000",
              balance_change_wei: "1000000000000000000",
              distributions_wei: "400000000000000000",
              distributions_count: 10,
              total_wei: "1400000000000000000",
            },
          ],
        },
      });

      testContext.fileManager.writeFeeReport(testData);
      const result = testContext.fileManager.readFeeReport();
      expect(result).toEqual(testData);
    });
  });
});
