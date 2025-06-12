import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import {
  FileManager as FileManagerInterface,
  OutflowData,
  OutflowEvent,
  CHAIN_IDS,
} from "../../../src/types";

// Test setup helper
function setupFileManager(): FileManagerInterface {
  return new FileManager();
}

describe("FileManager - Distributor Outflows", () => {
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

  describe("readDistributorOutflows()", () => {
    it("should return empty OutflowData when outflows.json does not exist", async () => {
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
