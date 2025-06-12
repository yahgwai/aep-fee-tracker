import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import { FileManager as FileManagerInterface } from "../../../src/types";

// Test constants
const VALID_ADDRESS = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
const VALID_ADDRESS_LOWERCASE = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";

// Test setup helper
function setupFileManager(): FileManagerInterface {
  return new FileManager();
}

describe("FileManager - Core Structure", () => {
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

  describe("Constructor", () => {
    it("should create a FileManager instance with required methods", () => {
      expect(fileManager).toBeDefined();
      expect(fileManager).toHaveProperty("ensureStoreDirectory");
      expect(fileManager).toHaveProperty("formatDate");
      expect(fileManager).toHaveProperty("validateAddress");
    });
  });

  describe("ensureStoreDirectory()", () => {
    it("should create store directory if it does not exist", async () => {
      expect(fs.existsSync("store")).toBe(false);

      await fileManager.ensureStoreDirectory();

      expect(fs.existsSync("store")).toBe(true);
      const stats = fs.statSync("store");
      expect(stats.isDirectory()).toBe(true);
    });

    it("should not error if directory already exists", async () => {
      fs.mkdirSync("store");

      await expect(fileManager.ensureStoreDirectory()).resolves.not.toThrow();

      expect(fs.existsSync("store")).toBe(true);
    });

    it("should handle concurrent directory creation gracefully", async () => {
      const promises = [
        fileManager.ensureStoreDirectory(),
        fileManager.ensureStoreDirectory(),
        fileManager.ensureStoreDirectory(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();

      expect(fs.existsSync("store")).toBe(true);
    });
  });

  describe("formatDate()", () => {
    it("should format date as YYYY-MM-DD in UTC", () => {
      const date = new Date("2024-01-15T12:34:56.789Z");
      expect(fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should handle dates at UTC midnight correctly", () => {
      const date = new Date("2024-01-15T00:00:00.000Z");
      expect(fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should handle dates at end of UTC day correctly", () => {
      const date = new Date("2024-01-15T23:59:59.999Z");
      expect(fileManager.formatDate(date)).toBe("2024-01-15");
    });

    it("should pad single digit months and days", () => {
      const date = new Date("2024-01-05T12:00:00.000Z");
      expect(fileManager.formatDate(date)).toBe("2024-01-05");
    });
  });

  describe("validateAddress()", () => {
    it("should checksum lowercase addresses", () => {
      expect(fileManager.validateAddress(VALID_ADDRESS_LOWERCASE)).toBe(
        VALID_ADDRESS,
      );
    });

    it("should accept already checksummed addresses", () => {
      expect(fileManager.validateAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS);
    });

    it("should reject addresses shorter than 42 characters", () => {
      expect(() => {
        fileManager.validateAddress("0x67a24ce4321ab3af");
      }).toThrow("Invalid address");
    });

    it("should reject addresses longer than 42 characters", () => {
      expect(() => {
        fileManager.validateAddress(VALID_ADDRESS_LOWERCASE + "123");
      }).toThrow("Invalid address");
    });

    it("should reject addresses with invalid characters", () => {
      expect(() => {
        fileManager.validateAddress(
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9zz",
        );
      }).toThrow("Invalid address");
    });

    it("should reject addresses that don't start with 0x", () => {
      expect(() => {
        fileManager.validateAddress("67a24ce4321ab3af51c2d0a4801c3e111d88c9d9");
      }).toThrow("Invalid address");
    });

    it("should provide specific error for invalid checksum", () => {
      expect(() => {
        fileManager.validateAddress(
          "0x67a24CE4321ab3af51c2d0a4801c3e111d88c9d9",
        );
      }).toThrow(/bad address checksum/i);
    });
  });
});
