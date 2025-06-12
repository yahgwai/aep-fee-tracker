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
  BalanceData,
  OutflowData,
  OutflowEvent,
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
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
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
              "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x2d9125e9",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x0000000000000000000000001234567890123456789012345678901234567890",
          },
          "0x2234567890123456789012345678901234567890": {
            type: DistributorType.L1_SURPLUS_FEE,
            discovered_block: 18901234,
            discovered_date: "2024-09-15",
            tx_hash:
              "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
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

  describe("writeDistributors()", () => {
    it("should validate all distributor addresses are checksummed", async () => {
      fileManager = new FileManager();

      const invalidData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await expect(fileManager.writeDistributors(invalidData)).rejects.toThrow(
        /address.*checksum/i,
      );
    });

    it("should validate distributor types match the DistributorType enum", async () => {
      fileManager = new FileManager();

      const invalidData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: "INVALID_TYPE",
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await expect(
        fileManager.writeDistributors(
          invalidData as unknown as DistributorsData,
        ),
      ).rejects.toThrow(/Invalid DistributorType value/);
    });

    it("should ensure all required fields are present", async () => {
      fileManager = new FileManager();

      const missingFieldData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            // missing discovered_date
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await expect(
        fileManager.writeDistributors(
          missingFieldData as unknown as DistributorsData,
        ),
      ).rejects.toThrow(/Missing required field.*discovered_date/);
    });

    it("should validate date formats", async () => {
      fileManager = new FileManager();

      const invalidDateData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "01/15/2024",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await expect(
        fileManager.writeDistributors(invalidDateData),
      ).rejects.toThrow(/Invalid date format/);
    });

    it("should validate transaction hashes", async () => {
      fileManager = new FileManager();

      const invalidTxHashData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xinvalid",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await expect(
        fileManager.writeDistributors(invalidTxHashData),
      ).rejects.toThrow(/Invalid transaction hash/);
    });

    it("should format JSON with 2-space indentation", async () => {
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
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0xee95a824",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };

      await fileManager.writeDistributors(testData);

      const fileContent = fs.readFileSync("store/distributors.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should create store directory if it does not exist", async () => {
      fileManager = new FileManager();

      expect(fs.existsSync("store")).toBe(false);

      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {},
      };

      await fileManager.writeDistributors(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/distributors.json")).toBe(true);
    });
  });

  describe("readDistributorBalances()", () => {
    it("should return empty BalanceData when balances.json does not exist", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const result = await fileManager.readDistributorBalances(address);

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {},
      });
    });

    it("should create distributor directory when writing balances for new address", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      expect(fs.existsSync(`store/distributors/${address}`)).toBe(false);

      await fileManager.writeDistributorBalances(address, testData);

      expect(fs.existsSync(`store/distributors/${address}`)).toBe(true);
      expect(fs.existsSync(`store/distributors/${address}/balances.json`)).toBe(
        true,
      );
    });

    it("should write and read back BalanceData with many dates", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {},
      };

      // Add 365 days of balance data
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      for (let i = 0; i < 365; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = fileManager.formatDate(date);
        testData.balances[dateStr] = {
          block_number: 12345678 + i * 1000,
          balance_wei: `${1000 + i}000000000000000000000`,
        };
      }

      await fileManager.writeDistributorBalances(address, testData);
      const result = await fileManager.readDistributorBalances(address);

      expect(result).toEqual(testData);
      expect(Object.keys(result.balances).length).toBe(365);
    });

    it("should preserve wei values as strings without modification", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const exactWeiValue = "1234567890123456789012345678901234567890";

      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: exactWeiValue,
          },
        },
      };

      await fileManager.writeDistributorBalances(address, testData);
      const result = await fileManager.readDistributorBalances(address);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe(exactWeiValue);
      expect(typeof result.balances["2024-01-15"]?.balance_wei).toBe("string");
    });

    it("should handle balance of 0 correctly", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "0",
          },
        },
      };

      await fileManager.writeDistributorBalances(address, testData);
      const result = await fileManager.readDistributorBalances(address);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe("0");
    });

    it("should update existing balance file with new dates", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";

      // Write initial data
      const initialData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await fileManager.writeDistributorBalances(address, initialData);

      // Update with additional dates
      const updatedData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
          "2024-01-16": {
            block_number: 12356789,
            balance_wei: "2000000000000000000000",
          },
        },
      };

      await fileManager.writeDistributorBalances(address, updatedData);
      const result = await fileManager.readDistributorBalances(address);

      expect(result).toEqual(updatedData);
      expect(Object.keys(result.balances).length).toBe(2);
    });
  });

  describe("writeDistributorBalances()", () => {
    it("should validate address is checksummed", async () => {
      fileManager = new FileManager();

      const lowercaseAddress = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";
      const checksummedAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: checksummedAddress, // Use checksummed address in metadata
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      // Should automatically checksum the address
      await fileManager.writeDistributorBalances(lowercaseAddress, testData);

      // Verify file was created with checksummed address
      expect(
        fs.existsSync(`store/distributors/${checksummedAddress}/balances.json`),
      ).toBe(true);
    });

    it("should validate reward_distributor matches the address parameter", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const differentAddress = "0x1234567890123456789012345678901234567890";

      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: differentAddress,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/address mismatch/);
    });

    it("should validate date formats in balances", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "01/15/2024": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/Invalid date format/);
    });

    it("should validate block numbers are positive", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: -1,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should reject negative wei values", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "-1000",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/Non-negative decimal string/);
    });

    it("should reject wei values in scientific notation", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1.23e+21",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/Invalid numeric format/);
    });

    it("should reject wei values with decimal points", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000.5",
          },
        },
      };

      await expect(
        fileManager.writeDistributorBalances(address, testData),
      ).rejects.toThrow(/no decimal points/);
    });

    it("should handle maximum uint256 wei values", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const maxUint256 =
        "115792089237316195423570985008687907853269984665640564039457584007913129639935";

      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: maxUint256,
          },
        },
      };

      await fileManager.writeDistributorBalances(address, testData);
      const result = await fileManager.readDistributorBalances(address);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe(maxUint256);
    });

    it("should format JSON with 2-space indentation", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await fileManager.writeDistributorBalances(address, testData);

      const filePath = `store/distributors/${address}/balances.json`;
      const fileContent = fs.readFileSync(filePath, "utf-8");

      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });
  });

  describe("readDistributorOutflows()", () => {
    it("should return empty OutflowData when outflows.json does not exist", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const result = await fileManager.readDistributorOutflows(address);

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {},
      });
    });

    it("should create distributor directory when writing outflows for new address", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1500000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1500000000000000000000",
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      expect(fs.existsSync(`store/distributors/${address}`)).toBe(false);

      await fileManager.writeDistributorOutflows(address, testData);

      expect(fs.existsSync(`store/distributors/${address}`)).toBe(true);
      expect(fs.existsSync(`store/distributors/${address}/outflows.json`)).toBe(
        true,
      );
    });

    it("should write and read back OutflowData with multiple dates", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "4000000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1500000000000000000000",
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
              {
                recipient: "0xbbB2345678901234567890123456789012345678",
                value_wei: "2500000000000000000000",
                tx_hash:
                  "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
              },
            ],
          },
          "2024-01-16": {
            block_number: 12356789,
            total_outflow_wei: "1000000000000000000000",
            events: [
              {
                recipient: "0xcCc3456789012345678901234567890123456789",
                value_wei: "1000000000000000000000",
                tx_hash:
                  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result).toEqual(testData);
    });

    it("should handle outflows with no events", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: [],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result).toEqual(testData);
    });

    it("should handle multiple events on the same day", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const events: OutflowEvent[] = [];
      let totalWei = BigInt(0);

      // Create 10 events for the same day with properly checksummed addresses
      const recipients = [
        "0x0Aa1234567890123456789012345678901234567",
        "0x1aA1234567890123456789012345678901234567",
        "0x2Aa1234567890123456789012345678901234567",
        "0x3AA1234567890123456789012345678901234567",
        "0x4Aa1234567890123456789012345678901234567",
        "0x5aA1234567890123456789012345678901234567",
        "0x6AA1234567890123456789012345678901234567",
        "0x7Aa1234567890123456789012345678901234567",
        "0x8Aa1234567890123456789012345678901234567",
        "0x9AA1234567890123456789012345678901234567",
      ];

      for (let i = 0; i < 10; i++) {
        const valueWei = `${1000 + i}000000000000000000`;
        totalWei += BigInt(valueWei);
        events.push({
          recipient: recipients[i]!,
          value_wei: valueWei,
          tx_hash: `0x${i.toString().padStart(1, "0")}ef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`,
        });
      }

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: totalWei.toString(),
            events: events,
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result).toEqual(testData);
      expect(result.outflows["2024-01-15"]?.events.length).toBe(10);
    });

    it("should preserve wei values as strings without modification", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const exactWeiValue = "1234567890123456789012345678901234567890";

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: exactWeiValue,
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: exactWeiValue,
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result.outflows["2024-01-15"]?.total_outflow_wei).toBe(
        exactWeiValue,
      );
      expect(result.outflows["2024-01-15"]?.events[0]?.value_wei).toBe(
        exactWeiValue,
      );
      expect(typeof result.outflows["2024-01-15"]?.events[0]?.value_wei).toBe(
        "string",
      );
    });

    it("should handle outflow value of 0 correctly", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: [],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result.outflows["2024-01-15"]?.total_outflow_wei).toBe("0");
    });
  });

  describe("writeDistributorOutflows()", () => {
    it("should validate address is checksummed", async () => {
      fileManager = new FileManager();

      const lowercaseAddress = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";
      const checksummedAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: checksummedAddress,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: [],
          },
        },
      };

      // Should automatically checksum the address
      await fileManager.writeDistributorOutflows(lowercaseAddress, testData);

      // Verify file was created with checksummed address
      expect(
        fs.existsSync(`store/distributors/${checksummedAddress}/outflows.json`),
      ).toBe(true);
    });

    it("should validate reward_distributor matches the address parameter", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const differentAddress = "0x1234567890123456789012345678901234567890";

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: differentAddress,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/address mismatch/);
    });

    it("should validate date formats in outflows", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "01/15/2024": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/Invalid date format/);
    });

    it("should validate block numbers are positive", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: -1,
            total_outflow_wei: "1000000000000000000000",
            events: [],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/positive integer/);
    });

    it("should reject negative total_outflow_wei values", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "-1000",
            events: [],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/Non-negative decimal string/);
    });

    it("should reject event value_wei in scientific notation", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1230000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1.23e+21",
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/Invalid numeric format/);
    });

    it("should validate recipient addresses are checksummed", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [
              {
                recipient: "0xaaa1234567890123456789012345678901234567", // lowercase
                value_wei: "1000000000000000000000",
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/address.*checksum/i);
    });

    it("should validate transaction hashes format", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1000000000000000000000",
                tx_hash: "0xinvalid", // invalid tx hash
              },
            ],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/Invalid transaction hash/);
    });

    it("should validate total_outflow_wei matches sum of events", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000", // total is 1000
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "500000000000000000000", // 500
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
              {
                recipient: "0xbbB2345678901234567890123456789012345678",
                value_wei: "600000000000000000000", // 600 - sum is 1100, not 1000!
                tx_hash:
                  "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
              },
            ],
          },
        },
      };

      await expect(
        fileManager.writeDistributorOutflows(address, testData),
      ).rejects.toThrow(/Total outflow mismatch/);
    });

    it("should handle maximum uint256 outflow values", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const maxUint256 =
        "115792089237316195423570985008687907853269984665640564039457584007913129639935";

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: maxUint256,
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: maxUint256,
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);
      const result = await fileManager.readDistributorOutflows(address);

      expect(result.outflows["2024-01-15"]?.total_outflow_wei).toBe(maxUint256);
      expect(result.outflows["2024-01-15"]?.events[0]?.value_wei).toBe(
        maxUint256,
      );
    });

    it("should format JSON with 2-space indentation", async () => {
      fileManager = new FileManager();

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1000000000000000000000",
                tx_hash:
                  "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              },
            ],
          },
        },
      };

      await fileManager.writeDistributorOutflows(address, testData);

      const filePath = `store/distributors/${address}/outflows.json`;
      const fileContent = fs.readFileSync(filePath, "utf-8");

      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should create store directory if it does not exist", async () => {
      fileManager = new FileManager();

      expect(fs.existsSync("store")).toBe(false);

      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: address,
        },
        outflows: {},
      };

      await fileManager.writeDistributorOutflows(address, testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync(`store/distributors/${address}/outflows.json`)).toBe(
        true,
      );
    });
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  describe("Validation Helper Methods", () => {
    let fileManager: FileManager;

    beforeEach(() => {
      fileManager = new FileManager();
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

  describe("enhanced validation in existing methods", () => {
    beforeEach(async () => {
      fileManager = new FileManager();
    });

    describe("writeBlockNumbers()", () => {
      it("should use validateDateFormat for date validation with context", async () => {
        const invalidDate = "2024-13-45"; // Invalid month and day
        const testData: BlockNumberData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
          },
          blocks: {
            [invalidDate]: 12345678,
          },
        };

        await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
          "Invalid date format: 2024-13-45. Expected YYYY-MM-DD",
        );
      });

      it("should use validateBlockNumber for block validation with context", async () => {
        const testData: BlockNumberData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
          },
          blocks: {
            "2024-01-15": -100, // Negative block number
          },
        };

        await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
          "Block number must be a positive integer, got: -100",
        );
      });

      it("should validate calendar dates not just format", async () => {
        const testData: BlockNumberData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
          },
          blocks: {
            "2024-02-30": 12345678, // February 30th doesn't exist
          },
        };

        await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
          "Invalid calendar date: 2024-02-30",
        );
      });

      it("should validate block numbers are within reasonable range", async () => {
        const testData: BlockNumberData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
          },
          blocks: {
            "2024-01-15": 2000000000, // Exceeds 1 billion blocks
          },
        };

        await expect(fileManager.writeBlockNumbers(testData)).rejects.toThrow(
          "Block number exceeds reasonable maximum: 2000000000 (max: 1000000000)",
        );
      });
    });

    describe("writeDistributors()", () => {
      it("should use validateEnumValue for distributor type validation", async () => {
        const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
        const testData: DistributorsData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
            arbowner_address: "0x0000000000000000000000000000000000000001",
          },
          distributors: {
            [address]: {
              address: address,
              // @ts-expect-error Testing invalid type
              type: "INVALID_TYPE",
              display_name: "Test Distributor",
              discovered_block: 12345678,
              discovered_date: "2024-01-15",
              tx_hash:
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              method: "create",
              owner: "0x0000000000000000000000000000000000000001",
              event_data: "{}",
            },
          },
        };

        await expect(fileManager.writeDistributors(testData)).rejects.toThrow(
          "Invalid DistributorType value: INVALID_TYPE. Valid values are: L2_BASE_FEE, L2_SURPLUS_FEE",
        );
      });
    });

    describe("writeDistributorBalances()", () => {
      it("should use validateWeiValue with proper context for balance validation", async () => {
        const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
        const testData: BalanceData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
            reward_distributor: address,
          },
          balances: {
            "2024-01-15": {
              block_number: 12345678,
              balance_wei: "1.23e21", // Scientific notation
            },
          },
        };

        await expect(
          fileManager.writeDistributorBalances(address, testData),
        ).rejects.toThrow(
          `Invalid numeric format\n` +
            `  Field: balance_wei\n` +
            `  Date: 2024-01-15\n` +
            `  Value: 1.23e21\n` +
            `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
        );
      });
    });

    describe("writeDistributorOutflows()", () => {
      it("should use validateWeiValue with context for total_outflow_wei", async () => {
        const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
        const testData: OutflowData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
            reward_distributor: address,
          },
          outflows: {
            "2024-01-15": {
              block_number: 12345678,
              total_outflow_wei: "1e18", // Scientific notation
              events: [],
            },
          },
        };

        await expect(
          fileManager.writeDistributorOutflows(address, testData),
        ).rejects.toThrow(
          `Invalid numeric format\n` +
            `  Field: total_outflow_wei\n` +
            `  Date: 2024-01-15\n` +
            `  Value: 1e18\n` +
            `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
        );
      });

      it("should use validateWeiValue with context for event value_wei", async () => {
        const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
        const testData: OutflowData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
            reward_distributor: address,
          },
          outflows: {
            "2024-01-15": {
              block_number: 12345678,
              total_outflow_wei: "1000000000000000000",
              events: [
                {
                  recipient: "0xAaa1234567890123456789012345678901234567",
                  value_wei: "1.0e18", // Scientific notation
                  tx_hash:
                    "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                },
              ],
            },
          },
        };

        await expect(
          fileManager.writeDistributorOutflows(address, testData),
        ).rejects.toThrow(
          `Invalid numeric format\n` +
            `  Field: event.value_wei\n` +
            `  Date: 2024-01-15\n` +
            `  Value: 1.0e18\n` +
            `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
        );
      });

      it("should use validateTransactionHash for tx_hash validation", async () => {
        const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
        const testData: OutflowData = {
          metadata: {
            chain_id: CHAIN_IDS.ARBITRUM_ONE,
            reward_distributor: address,
          },
          outflows: {
            "2024-01-15": {
              block_number: 12345678,
              total_outflow_wei: "1000000000000000000",
              events: [
                {
                  recipient: "0xAaa1234567890123456789012345678901234567",
                  value_wei: "1000000000000000000",
                  tx_hash: "0xinvalidhash", // Invalid tx hash
                },
              ],
            },
          },
        };

        await expect(
          fileManager.writeDistributorOutflows(address, testData),
        ).rejects.toThrow(
          "Invalid transaction hash format: 0xinvalidhash. Expected 0x followed by 64 hexadecimal characters",
        );
      });
    });
  });
});
