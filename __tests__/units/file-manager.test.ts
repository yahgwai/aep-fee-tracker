import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../src/file-manager";
import { FileManager as FileManagerInterface } from "../../src/types";

describe("FileManager - Core Structure", () => {
  let tempDir: string;
  let fileManager: FileManagerInterface;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-manager-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir("/");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Constructor", () => {
    it("should create a FileManager instance", () => {
      fileManager = new FileManager();
      expect(fileManager).toBeDefined();
      expect(fileManager).toHaveProperty("ensureStoreDirectory");
      expect(fileManager).toHaveProperty("formatDate");
      expect(fileManager).toHaveProperty("validateAddress");
    });
  });

  describe("ensureStoreDirectory()", () => {
    it("should create store directory if it does not exist", async () => {
      fileManager = new FileManager();

      expect(fs.existsSync("store")).toBe(false);

      await fileManager.ensureStoreDirectory();

      expect(fs.existsSync("store")).toBe(true);
      const stats = fs.statSync("store");
      expect(stats.isDirectory()).toBe(true);
    });

    it("should not error if directory already exists", async () => {
      fileManager = new FileManager();
      fs.mkdirSync("store");

      await expect(fileManager.ensureStoreDirectory()).resolves.not.toThrow();

      expect(fs.existsSync("store")).toBe(true);
    });

    it("should handle concurrent directory creation gracefully", async () => {
      fileManager = new FileManager();

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
      fileManager = new FileManager();

      const date = new Date("2024-01-15T12:34:56.789Z");
      const formatted = fileManager.formatDate(date);

      expect(formatted).toBe("2024-01-15");
    });

    it("should handle dates at UTC midnight correctly", () => {
      fileManager = new FileManager();

      const date = new Date("2024-01-15T00:00:00.000Z");
      const formatted = fileManager.formatDate(date);

      expect(formatted).toBe("2024-01-15");
    });

    it("should handle dates at end of UTC day correctly", () => {
      fileManager = new FileManager();

      const date = new Date("2024-01-15T23:59:59.999Z");
      const formatted = fileManager.formatDate(date);

      expect(formatted).toBe("2024-01-15");
    });

    it("should pad single digit months and days", () => {
      fileManager = new FileManager();

      const date = new Date("2024-01-05T12:00:00.000Z");
      const formatted = fileManager.formatDate(date);

      expect(formatted).toBe("2024-01-05");
    });
  });

  describe("validateAddress()", () => {
    it("should checksum lowercase addresses", () => {
      fileManager = new FileManager();

      const lowercase = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";
      const checksummed = fileManager.validateAddress(lowercase);

      expect(checksummed).toBe("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
    });

    it("should accept already checksummed addresses", () => {
      fileManager = new FileManager();

      const checksummed = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const result = fileManager.validateAddress(checksummed);

      expect(result).toBe(checksummed);
    });

    it("should reject addresses shorter than 42 characters", () => {
      fileManager = new FileManager();

      expect(() => {
        fileManager.validateAddress("0x67a24ce4321ab3af");
      }).toThrow("Invalid address");
    });

    it("should reject addresses longer than 42 characters", () => {
      fileManager = new FileManager();

      expect(() => {
        fileManager.validateAddress(
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9123",
        );
      }).toThrow("Invalid address");
    });

    it("should reject addresses with invalid characters", () => {
      fileManager = new FileManager();

      expect(() => {
        fileManager.validateAddress(
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9zz",
        );
      }).toThrow("Invalid address");
    });

    it("should reject addresses that don't start with 0x", () => {
      fileManager = new FileManager();

      expect(() => {
        fileManager.validateAddress("67a24ce4321ab3af51c2d0a4801c3e111d88c9d9");
      }).toThrow("Invalid address");
    });

    it("should provide specific error for invalid checksum", () => {
      fileManager = new FileManager();

      expect(() => {
        fileManager.validateAddress(
          "0x67a24CE4321ab3af51c2d0a4801c3e111d88c9d9",
        );
      }).toThrow(/bad address checksum/i);
    });
  });
});
