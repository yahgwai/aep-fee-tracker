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
      chain_id: CHAIN_IDS.ARBITRUM_NOVA,
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
    block: number;
    date: string;
    tx_hash: string;
    method: string;
    owner: string;
    event_data: string;
    is_reward_distributor: boolean;
    distributor_address: string;
  }>,
): {
  type: DistributorType;
  block: number;
  date: string;
  tx_hash: string;
  method: string;
  owner: string;
  event_data: string;
  is_reward_distributor: boolean;
  distributor_address: string;
} {
  return {
    type: DistributorType.L2_BASE_FEE,
    block: TEST_BLOCK_NUMBER,
    date: TEST_DATE,
    tx_hash: VALID_TX_HASH,
    method: "0x57f585db",
    owner: CONTRACTS.ARB_OWNER,
    event_data:
      "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
    is_reward_distributor: true,
    distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
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
    it("should return undefined when distributors.json does not exist", () => {
      const result = testContext.fileManager.readDistributors();
      expect(result).toBeUndefined();
    });

    it("should write and read back DistributorsData with multiple distributors", () => {
      const testData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: createDistributorInfo(),
          [INVALID_ADDRESS]: createDistributorInfo({
            type: DistributorType.L2_SURPLUS_FEE,
            block: 15678901,
            date: "2024-06-01",
            tx_hash:
              "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0xfcdde2b4",
            event_data:
              "0x0000000000000000000000001234567890123456789012345678901234567890",
            distributor_address: INVALID_ADDRESS,
          }),
          "0x2234567890123456789012345678901234567890": createDistributorInfo({
            type: DistributorType.L1_SURPLUS_FEE,
            block: 18901234,
            date: "2024-09-15",
            tx_hash:
              "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
            method: "0x934be07d",
            event_data:
              "0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12",
            distributor_address: "0x2234567890123456789012345678901234567890",
          }),
        },
      });

      testContext.fileManager.writeDistributors(testData);
      const result = testContext.fileManager.readDistributors();

      expect(result).toEqual(testData);
    });
  });

  describe("writeDistributors()", () => {
    it("should validate all distributor addresses are checksummed", () => {
      const invalidData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS_LOWERCASE]: createDistributorInfo(),
        },
      });

      expect(() =>
        testContext.fileManager.writeDistributors(invalidData),
      ).toThrow(/address.*checksum/i);
    });

    it("should validate distributor types match the DistributorType enum", () => {
      const invalidData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: {
            ...createDistributorInfo(),
            type: "INVALID_TYPE" as unknown as DistributorType,
          },
        },
      });

      expect(() =>
        testContext.fileManager.writeDistributors(invalidData),
      ).toThrow(/Invalid DistributorType value/);
    });

    it("should ensure all required fields are present", () => {
      const distributorInfo = createDistributorInfo();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { date, ...incompleteInfo } = distributorInfo;
      const missingFieldData = createDistributorsData({
        distributors: {
          [VALID_ADDRESS]: incompleteInfo as unknown as typeof distributorInfo,
        },
      });

      expect(() =>
        testContext.fileManager.writeDistributors(missingFieldData),
      ).toThrow(/Missing required field.*date/);
    });

    it("should validate date formats", () => {
      const invalidDateData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            block: 12345678,
            date: "01/15/2024",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0x57f585db",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributors(invalidDateData),
      ).toThrow(/Invalid date format/);
    });

    it("should validate transaction hashes", () => {
      const invalidTxHashData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            block: 12345678,
            date: "2024-01-15",
            tx_hash: "0xinvalid",
            method: "0x57f585db",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributors(invalidTxHashData),
      ).toThrow(/Invalid transaction hash/);
    });

    it("should format JSON with 2-space indentation", () => {
      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            block: 12345678,
            date: "2024-01-15",
            tx_hash:
              "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
            method: "0x57f585db",
            owner: CONTRACTS.ARB_OWNER,
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      testContext.fileManager.writeDistributors(testData);

      const fileContent = fs.readFileSync("store/distributors.json", "utf-8");
      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });

    it("should create store directory if it does not exist", () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {},
      };

      testContext.fileManager.writeDistributors(testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(fs.existsSync("store/distributors.json")).toBe(true);
    });

    it("should use validateEnumValue for distributor type validation", () => {
      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: "0x0000000000000000000000000000000000000001",
        },
        distributors: {
          [address]: {
            address: address,
            // @ts-expect-error Testing invalid type
            type: "INVALID_TYPE",
            display_name: "Test Distributor",
            block: 12345678,
            date: "2024-01-15",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "create",
            owner: "0x0000000000000000000000000000000000000001",
            event_data: "{}",
            is_reward_distributor: true,
          },
        },
      };

      expect(() => testContext.fileManager.writeDistributors(testData)).toThrow(
        "Invalid DistributorType value: INVALID_TYPE. Valid values are: L2_BASE_FEE, L2_SURPLUS_FEE",
      );
    });
  });
});
