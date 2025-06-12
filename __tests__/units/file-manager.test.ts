import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../src/file-manager";
import {
  FileManager as FileManagerInterface,
  BlockNumberData,
  DistributorsData,
  DistributorType,
  CHAIN_IDS,
  CONTRACTS,
} from "../../src/types";

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

  describe("readBlockNumbers()", () => {
    it("should return empty BlockNumberData when block_numbers.json does not exist", async () => {
      fileManager = new FileManager();

      const result: BlockNumberData = await fileManager.readBlockNumbers();

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {},
      });
    });

    it("should write and read back BlockNumberData with multiple date entries", async () => {
      fileManager = new FileManager();

      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
          "2024-01-17": 12367890,
        },
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });

    it("should preserve block number precision for large block numbers", async () => {
      fileManager = new FileManager();

      const largeBlockNumber = 200000000;
      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": largeBlockNumber,
        },
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result.blocks["2024-01-15"]).toBe(largeBlockNumber);
    });

    it("should format JSON with 2-space indentation for human readability", async () => {
      fileManager = new FileManager();

      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": 12345678,
        },
      };

      await fileManager.writeBlockNumbers(testData);

      const fileContent = fs.readFileSync("store/block_numbers.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should maintain date ordering in blocks object", async () => {
      fileManager = new FileManager();

      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-17": 12367890,
          "2024-01-15": 12345678,
          "2024-01-16": 12356789,
        },
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      const dates = Object.keys(result.blocks);
      expect(dates).toEqual(["2024-01-17", "2024-01-15", "2024-01-16"]);
    });

    it("should handle single date entry correctly", async () => {
      fileManager = new FileManager();

      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": 12345678,
        },
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();

      expect(result).toEqual(testData);
    });
  });

  describe("writeBlockNumbers()", () => {
    it("should validate date formats are YYYY-MM-DD", async () => {
      fileManager = new FileManager();

      const invalidData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "01/15/2024": 12345678,
        },
      };

      await expect(fileManager.writeBlockNumbers(invalidData)).rejects.toThrow(
        /Invalid date format/,
      );
    });

    it("should ensure block numbers are positive integers", async () => {
      fileManager = new FileManager();

      const negativeBlockData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": -12345678,
        },
      };

      await expect(
        fileManager.writeBlockNumbers(negativeBlockData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should reject zero as block number", async () => {
      fileManager = new FileManager();

      const zeroBlockData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": 0,
        },
      };

      await expect(
        fileManager.writeBlockNumbers(zeroBlockData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should create store directory if it does not exist", async () => {
      fileManager = new FileManager();

      expect(fs.existsSync("store")).toBe(false);

      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {
          "2024-01-15": 12345678,
        },
      };

      await fileManager.writeBlockNumbers(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/block_numbers.json")).toBe(true);
    });
  });

  describe("readDistributors()", () => {
    it("should return empty DistributorsData when distributors.json does not exist", async () => {
      fileManager = new FileManager();

      const result: DistributorsData = await fileManager.readDistributors();

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {},
      });
    });

    it("should write and read back DistributorsData with multiple distributors", async () => {
      fileManager = new FileManager();

      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
          "0x1234567890123456789012345678901234567890": {
            type: DistributorType.L2_SURPLUS_FEE,
            discovered_block: 15678901,
            discovered_date: "2024-06-01",
            tx_hash:
              "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
            method: "0x2d9125e9",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x0000000000000000000000001234567890123456789012345678901234567890",
          },
          "0xABCDEF1234567890ABCDEF1234567890ABCDEF12": {
            type: DistributorType.L1_SURPLUS_FEE,
            discovered_block: 18901234,
            discovered_date: "2024-09-15",
            tx_hash:
              "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
            method: "0x934be07d",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12",
          },
        },
      };

      await fileManager.writeDistributors(testData);
      const result = await fileManager.readDistributors();

      expect(result).toEqual(testData);
    });
  });
});
