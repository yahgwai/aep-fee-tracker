import { describe, it, expect, beforeEach } from "@jest/globals";
import { FileManager } from "../../../src/file-manager";
import { setupFileManager } from "./test-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("FileManager - Validation Helper Methods", () => {
  let fileManager: FileManager;

  beforeEach(() => {
    fileManager = setupFileManager() as FileManager;
  });

  describe("validateDateFormat()", () => {
    it("should validate correct date format YYYY-MM-DD", () => {
      expect(() =>
        (fileManager as any).validateDateFormat("2024-01-15"),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateDateFormat("2023-12-31"),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateDateFormat("2025-06-01"),
      ).not.toThrow();
    });

    it("should reject invalid date formats", () => {
      expect(() =>
        (fileManager as any).validateDateFormat("2024-1-15"),
      ).toThrow("Invalid date format: 2024-1-15. Expected YYYY-MM-DD");
      expect(() =>
        (fileManager as any).validateDateFormat("2024/01/15"),
      ).toThrow("Invalid date format: 2024/01/15. Expected YYYY-MM-DD");
      expect(() =>
        (fileManager as any).validateDateFormat("01-15-2024"),
      ).toThrow("Invalid date format: 01-15-2024. Expected YYYY-MM-DD");
    });

    it("should validate actual calendar dates", () => {
      expect(() =>
        (fileManager as any).validateDateFormat("2024-02-29"),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateDateFormat("2024-02-30"),
      ).toThrow("Invalid calendar date: 2024-02-30");
      expect(() =>
        (fileManager as any).validateDateFormat("2024-13-01"),
      ).toThrow("Invalid date format: 2024-13-01. Expected YYYY-MM-DD");
      expect(() =>
        (fileManager as any).validateDateFormat("2023-02-29"),
      ).toThrow("Invalid calendar date: 2023-02-29");
    });
  });

  describe("validateBlockNumber()", () => {
    it("should accept positive integers", () => {
      expect(() => (fileManager as any).validateBlockNumber(1)).not.toThrow();
      expect(() =>
        (fileManager as any).validateBlockNumber(12345678),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateBlockNumber(999999999),
      ).not.toThrow();
    });

    it("should reject non-positive numbers", () => {
      expect(() => (fileManager as any).validateBlockNumber(0)).toThrow(
        "Block number must be a positive integer, got: 0",
      );
      expect(() => (fileManager as any).validateBlockNumber(-1)).toThrow(
        "Block number must be a positive integer, got: -1",
      );
    });

    it("should reject non-integers", () => {
      expect(() => (fileManager as any).validateBlockNumber(1.5)).toThrow(
        "Block number must be a positive integer, got: 1.5",
      );
      expect(() => (fileManager as any).validateBlockNumber(NaN)).toThrow(
        "Block number must be a positive integer, got: NaN",
      );
    });

    it("should reject numbers outside reasonable range", () => {
      expect(() =>
        (fileManager as any).validateBlockNumber(999999999999),
      ).toThrow(
        "Block number exceeds reasonable maximum: 999999999999 (max: 1000000000)",
      );
    });
  });

  describe("validateWeiValue()", () => {
    it("should accept valid decimal strings", () => {
      expect(() => (fileManager as any).validateWeiValue("0")).not.toThrow();
      expect(() =>
        (fileManager as any).validateWeiValue("1000000000000000000000"),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateWeiValue(
          "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        ),
      ).not.toThrow();
    });

    it("should reject scientific notation", () => {
      expect(() => (fileManager as any).validateWeiValue("1.23e+21")).toThrow(
        /Invalid numeric format.*Expected: Decimal string/,
      );
      expect(() => (fileManager as any).validateWeiValue("1E18")).toThrow(
        /Invalid numeric format.*Expected: Decimal string/,
      );
    });

    it("should reject decimal points", () => {
      expect(() => (fileManager as any).validateWeiValue("100.5")).toThrow(
        /Invalid wei value.*Expected: Integer string \(no decimal points\)/,
      );
      expect(() => (fileManager as any).validateWeiValue("0.1")).toThrow(
        /Invalid wei value.*Expected: Integer string \(no decimal points\)/,
      );
    });

    it("should reject negative values", () => {
      expect(() => (fileManager as any).validateWeiValue("-1000")).toThrow(
        /Invalid wei value.*Expected: Non-negative decimal string/,
      );
    });

    it("should reject non-numeric strings", () => {
      expect(() => (fileManager as any).validateWeiValue("abc")).toThrow(
        /Invalid wei value.*Expected: Decimal string containing only digits/,
      );
      expect(() => (fileManager as any).validateWeiValue("")).toThrow(
        /Invalid wei value.*Expected: Decimal string containing only digits/,
      );
    });

    it("should provide detailed error context", () => {
      try {
        (fileManager as any).validateWeiValue(
          "1.23e+21",
          "balance",
          "2024-01-15",
          "0x123...456",
        );
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain("Invalid numeric format");
          expect(error.message).toContain("Field: balance");
          expect(error.message).toContain("Date: 2024-01-15");
          expect(error.message).toContain("Value: 1.23e+21");
          expect(error.message).toContain("Expected: Decimal string");
        }
      }
    });
  });

  describe("validateTransactionHash()", () => {
    it("should accept valid transaction hashes", () => {
      expect(() =>
        (fileManager as any).validateTransactionHash(
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        ),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateTransactionHash(
          "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
        ),
      ).not.toThrow();
    });

    it("should reject invalid transaction hashes", () => {
      expect(() =>
        (fileManager as any).validateTransactionHash("0x123"),
      ).toThrow(
        "Invalid transaction hash format: 0x123. Expected 0x followed by 64 hexadecimal characters",
      );
      expect(() =>
        (fileManager as any).validateTransactionHash(
          "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        ),
      ).toThrow(
        "Invalid transaction hash format: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef. Expected 0x followed by 64 hexadecimal characters",
      );
      expect(() =>
        (fileManager as any).validateTransactionHash(
          "0xgggg567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        ),
      ).toThrow(
        "Invalid transaction hash format: 0xgggg567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef. Expected 0x followed by 64 hexadecimal characters",
      );
    });
  });

  describe("validateEnumValue()", () => {
    it("should accept valid enum values", () => {
      expect(() =>
        (fileManager as any).validateEnumValue(
          "L2_BASE_FEE",
          "DistributorType",
          ["L2_BASE_FEE", "L2_SURPLUS_FEE"],
        ),
      ).not.toThrow();
      expect(() =>
        (fileManager as any).validateEnumValue(
          "L2_SURPLUS_FEE",
          "DistributorType",
          ["L2_BASE_FEE", "L2_SURPLUS_FEE"],
        ),
      ).not.toThrow();
    });

    it("should reject invalid enum values", () => {
      expect(() =>
        (fileManager as any).validateEnumValue("INVALID", "DistributorType", [
          "L2_BASE_FEE",
          "L2_SURPLUS_FEE",
        ]),
      ).toThrow(
        "Invalid DistributorType value: INVALID. Valid values are: L2_BASE_FEE, L2_SURPLUS_FEE",
      );
      expect(() =>
        (fileManager as any).validateEnumValue("", "DistributorType", [
          "L2_BASE_FEE",
          "L2_SURPLUS_FEE",
        ]),
      ).toThrow(
        "Invalid DistributorType value: . Valid values are: L2_BASE_FEE, L2_SURPLUS_FEE",
      );
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
