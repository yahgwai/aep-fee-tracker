import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_ADDRESS_LOWERCASE,
  TestContext,
} from "./test-utils";

describe("FileManager - Core Structure", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("Constructor", () => {
    it("should create a FileManager instance with required methods", () => {
      expect(testContext.fileManager).toBeDefined();
      expect(testContext.fileManager).toHaveProperty("ensureStoreDirectory");
      expect(testContext.fileManager).toHaveProperty("formatDate");
      expect(testContext.fileManager).toHaveProperty("validateAddress");
    });
  });

  describe("ensureStoreDirectory()", () => {
    it("should create store directory if it does not exist", () => {
      expect(fs.existsSync("store")).toBe(false);

      testContext.fileManager.ensureStoreDirectory();

      expect(fs.existsSync("store")).toBe(true);
      const stats = fs.statSync("store");
      expect(stats.isDirectory()).toBe(true);
    });

    it("should not error if directory already exists", () => {
      fs.mkdirSync("store");

      expect(() =>
        testContext.fileManager.ensureStoreDirectory(),
      ).not.toThrow();

      expect(fs.existsSync("store")).toBe(true);
    });

    it("should handle concurrent directory creation gracefully", () => {
      // Since methods are now synchronous, we'll just call them sequentially
      expect(() => {
        testContext.fileManager.ensureStoreDirectory();
        testContext.fileManager.ensureStoreDirectory();
        testContext.fileManager.ensureStoreDirectory();
      }).not.toThrow();

      expect(fs.existsSync("store")).toBe(true);
    });
  });

  describe("formatDate()", () => {
    it("should format date as YYYY-MM-DD in UTC", () => {
      const date = new Date("2024-01-15T12:34:56.789Z");
      expect(testContext.fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should handle dates at UTC midnight correctly", () => {
      const date = new Date("2024-01-15T00:00:00.000Z");
      expect(testContext.fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should handle dates at end of UTC day correctly", () => {
      const date = new Date("2024-01-15T23:59:59.999Z");
      expect(testContext.fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should pad single digit months and days", () => {
      const date = new Date("2024-01-05T12:00:00.000Z");
      expect(testContext.fileManager.formatDate(date)).toBe("2024-01-05");
    });
  });

  describe("validateAddress()", () => {
    it("should checksum lowercase addresses", () => {
      expect(
        testContext.fileManager.validateAddress(VALID_ADDRESS_LOWERCASE),
      ).toBe(VALID_ADDRESS);
    });

    it("should accept already checksummed addresses", () => {
      expect(testContext.fileManager.validateAddress(VALID_ADDRESS)).toBe(
        VALID_ADDRESS,
      );
    });

    it("should reject addresses shorter than 42 characters", () => {
      expect(() => {
        testContext.fileManager.validateAddress("0x67a24ce4321ab3af");
      }).toThrow("Invalid address");
    });

    it("should reject addresses longer than 42 characters", () => {
      expect(() => {
        testContext.fileManager.validateAddress(
          VALID_ADDRESS_LOWERCASE + "123",
        );
      }).toThrow("Invalid address");
    });

    it("should reject addresses with invalid characters", () => {
      expect(() => {
        testContext.fileManager.validateAddress(
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9zz",
        );
      }).toThrow("Invalid address");
    });

    it("should reject addresses that don't start with 0x", () => {
      expect(() => {
        testContext.fileManager.validateAddress(
          "67a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
        );
      }).toThrow("Invalid address");
    });

    it("should provide specific error for invalid checksum", () => {
      expect(() => {
        testContext.fileManager.validateAddress(
          "0x67a24CE4321ab3af51c2d0a4801c3e111d88c9d9",
        );
      }).toThrow(/bad address checksum/i);
    });
  });
});
