import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import {
  FileManager as FileManagerInterface,
  BalanceData,
  CHAIN_IDS,
} from "../../../src/types";

// Test constants
const VALID_ADDRESS = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
const TEST_DATE = "2024-01-15";
const TEST_BLOCK_NUMBER = 12345678;

// Test data factory functions
function createBalanceData(
  address: string,
  overrides?: Partial<BalanceData>,
): BalanceData {
  return {
    metadata: {
      chain_id: CHAIN_IDS.ARBITRUM_ONE,
      reward_distributor: address,
    },
    balances: {},
    ...overrides,
  };
}

// Test data factory for balance entries
function createBalanceEntry(
  overrides?: Partial<{
    block_number: number;
    balance_wei: string;
  }>,
): {
  block_number: number;
  balance_wei: string;
} {
  return {
    block_number: TEST_BLOCK_NUMBER,
    balance_wei: "1000000000000000000000",
    ...overrides,
  };
}

// Test setup helper
function setupFileManager(): FileManagerInterface {
  return new FileManager();
}

describe("FileManager - Distributor Balances", () => {
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

  describe("readDistributorBalances()", () => {
    it("should return empty BalanceData when balances.json does not exist", async () => {
      const result = await fileManager.readDistributorBalances(VALID_ADDRESS);
      expect(result).toEqual(createBalanceData(VALID_ADDRESS));
    });

    it("should create distributor directory when writing balances for new address", async () => {
      const testData = createBalanceData(VALID_ADDRESS, {
        balances: {
          [TEST_DATE]: createBalanceEntry(),
        },
      });

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(false);

      await fileManager.writeDistributorBalances(VALID_ADDRESS, testData);

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(true);
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/balances.json`),
      ).toBe(true);
    });

    it("should write and read back BalanceData with many dates", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {},
      };

      // Add 365 days of balance data
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      for (let i = 0; i < 365; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0]!;
        testData.balances[dateStr] = {
          block_number: TEST_BLOCK_NUMBER + i * 1000,
          balance_wei: `${1000 + i}000000000000000000000`,
        };
      }

      await fileManager.writeDistributorBalances(VALID_ADDRESS, testData);
      const result = await fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result).toEqual(testData);
      expect(Object.keys(result.balances).length).toBe(365);
    });

    it("should preserve wei values as strings without modification", async () => {
      const exactWeiValue = "1234567890123456789012345678901234567890";
      const testData = createBalanceData(VALID_ADDRESS, {
        balances: {
          [TEST_DATE]: createBalanceEntry({ balance_wei: exactWeiValue }),
        },
      });

      await fileManager.writeDistributorBalances(VALID_ADDRESS, testData);
      const result = await fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result.balances[TEST_DATE]?.balance_wei).toBe(exactWeiValue);
      expect(typeof result.balances[TEST_DATE]?.balance_wei).toBe("string");
    });

    it("should handle balance of 0 correctly", async () => {
      const testData = createBalanceData(VALID_ADDRESS, {
        balances: {
          [TEST_DATE]: createBalanceEntry({ balance_wei: "0" }),
        },
      });

      await fileManager.writeDistributorBalances(VALID_ADDRESS, testData);
      const result = await fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result.balances[TEST_DATE]?.balance_wei).toBe("0");
    });

    it("should update existing balance file with new dates", async () => {
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
});
