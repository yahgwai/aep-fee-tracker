import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_ADDRESS_LOWERCASE,
  INVALID_ADDRESS,
  VALID_TX_HASH,
  createTestDate,
  TestContext,
} from "./test-utils";
import {
  DistributorsData,
  DistributorType,
  CHAIN_IDS,
  CONTRACTS,
} from "../../../src/types";

// Test constants
const TEST_DATE = createTestDate();
const TEST_BLOCK_NUMBER = 12345678;

// Test data factory functions
function createDistributorsData(
  overrides?: Partial<DistributorsData>,
): DistributorsData {
  return {
    metadata: {
      chain_id: CHAIN_IDS.ARBITRUM_ONE,
      arbowner_address: CONTRACTS.ARB_OWNER,
    },
    distributors: {},
    ...overrides,
  };
}

// Test data factory for distributor info
function createDistributorInfo(
  overrides?: Partial<{
    type: DistributorType;
    discovered_block: number;
    discovered_date: string;
    tx_hash: string;
    method: string;
    owner: string;
    event_data: string;
  }>,
): {
  type: DistributorType;
  discovered_block: number;
  discovered_date: string;
  tx_hash: string;
  method: string;
  owner: string;
  event_data: string;
} {
  return {
    type: DistributorType.L2_BASE_FEE,
    discovered_block: TEST_BLOCK_NUMBER,
    discovered_date: TEST_DATE,
    tx_hash: VALID_TX_HASH,
    method: "0xee95a824",
    owner: CONTRACTS.ARB_OWNER,
    event_data:
      "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
    ...overrides,
  };
}

describe("FileManager - Distributors", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readDistributors()", () => {
    it("should return empty DistributorsData when distributors.json does not exist", async () => {
      const result = await testContext.fileManager.readDistributors();
      expect(result).toEqual(createDistributorsData());
    });

    it("should write and read back DistributorsData with multiple distributors", async () => {
      const testData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: createDistributorInfo(),
          [INVALID_ADDRESS]: createDistributorInfo({
            type: DistributorType.L2_SURPLUS_FEE,
            discovered_block: 15678901,
            discovered_date: "2024-06-01",
            tx_hash:
              "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x2d9125e9",
            event_data:
              "0x0000000000000000000000001234567890123456789012345678901234567890",
          }),
          "0x2234567890123456789012345678901234567890": createDistributorInfo({
            type: DistributorType.L1_SURPLUS_FEE,
            discovered_block: 18901234,
            discovered_date: "2024-09-15",
            tx_hash:
              "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
            method: "0x934be07d",
            event_data:
              "0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12",
          }),
        },
      });

      await testContext.fileManager.writeDistributors(testData);
      const result = await testContext.fileManager.readDistributors();

      expect(result).toEqual(testData);
    });
  });

  describe("writeDistributors()", () => {
    it("should validate all distributor addresses are checksummed", async () => {
      const invalidData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS_LOWERCASE]: createDistributorInfo(),
        },
      });

      await expect(
        testContext.fileManager.writeDistributors(invalidData),
      ).rejects.toThrow(/address.*checksum/i);
    });

    it("should validate distributor types match the DistributorType enum", async () => {
      const invalidData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: {
            ...createDistributorInfo(),
            type: "INVALID_TYPE" as unknown as DistributorType,
          },
        },
      });

      await expect(
        testContext.fileManager.writeDistributors(invalidData),
      ).rejects.toThrow(/Invalid DistributorType value/);
    });

    it("should ensure all required fields are present", async () => {
      const distributorInfo = createDistributorInfo();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { discovered_date, ...incompleteInfo } = distributorInfo;
      const missingFieldData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: incompleteInfo as unknown as typeof distributorInfo,
        },
      });

      await expect(
        testContext.fileManager.writeDistributors(missingFieldData),
      ).rejects.toThrow(/Missing required field.*discovered_date/);
    });

    it("should validate date formats", async () => {
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
        testContext.fileManager.writeDistributors(invalidDateData),
      ).rejects.toThrow(/Invalid date format/);
    });

    it("should validate transaction hashes", async () => {
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
        testContext.fileManager.writeDistributors(invalidTxHashData),
      ).rejects.toThrow(/Invalid transaction hash/);
    });

    it("should format JSON with 2-space indentation", async () => {
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

      await testContext.fileManager.writeDistributors(testData);

      const fileContent = fs.readFileSync("store/distributors.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should create store directory if it does not exist", async () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {},
      };

      await testContext.fileManager.writeDistributors(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/distributors.json")).toBe(true);
    });

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

      await expect(
        testContext.fileManager.writeDistributors(testData),
      ).rejects.toThrow(
        "Invalid DistributorType value: INVALID_TYPE. Valid values are: L2_BASE_FEE, L2_SURPLUS_FEE",
      );
    });
  });
});
