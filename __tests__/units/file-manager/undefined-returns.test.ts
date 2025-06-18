import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
  VALID_ADDRESS,
} from "./test-utils";
import {
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  CHAIN_IDS,
  CONTRACTS,
} from "../../../src/types";

describe("FileManager - Undefined Returns", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readBlockNumbers()", () => {
    it("should return undefined when block_numbers.json does not exist", () => {
      const result = testContext.fileManager.readBlockNumbers();
      expect(result).toBeUndefined();
    });

    it("should return data when block_numbers.json exists", () => {
      const testData: BlockNumberData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
        },
        blocks: {
          "2024-01-15": 12345678,
        },
      };

      // Write file directly to simulate existing data
      testContext.fileManager.ensureStoreDirectory();
      fs.writeFileSync(
        path.join("store", "block_numbers.json"),
        JSON.stringify(testData, null, 2),
      );

      const result = testContext.fileManager.readBlockNumbers();
      expect(result).toEqual(testData);
    });
  });

  describe("readDistributors()", () => {
    it("should return undefined when distributors.json does not exist", () => {
      const result = testContext.fileManager.readDistributors();
      expect(result).toBeUndefined();
    });

    it("should return data when distributors.json exists", () => {
      const testData: DistributorsData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {},
      };

      // Write file directly to simulate existing data
      testContext.fileManager.ensureStoreDirectory();
      fs.writeFileSync(
        path.join("store", "distributors.json"),
        JSON.stringify(testData, null, 2),
      );

      const result = testContext.fileManager.readDistributors();
      expect(result).toEqual(testData);
    });
  });

  describe("readDistributorBalances()", () => {
    it("should return undefined when balances.json does not exist", () => {
      const result =
        testContext.fileManager.readDistributorBalances(VALID_ADDRESS);
      expect(result).toBeUndefined();
    });

    it("should return data when balances.json exists", () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000",
          },
        },
      };

      // Write file directly to simulate existing data
      const distributorDir = path.join("store", "distributors", VALID_ADDRESS);
      fs.mkdirSync(distributorDir, { recursive: true });
      fs.writeFileSync(
        path.join(distributorDir, "balances.json"),
        JSON.stringify(testData, null, 2),
      );

      const result =
        testContext.fileManager.readDistributorBalances(VALID_ADDRESS);
      expect(result).toEqual(testData);
    });

    it("should not create default data with address when file doesn't exist", () => {
      // The current implementation creates default data using the address parameter
      // After refactoring, it should return undefined instead
      const result =
        testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      // Currently this returns default data, but should return undefined
      expect(result).toBeUndefined();
    });
  });

  describe("readDistributorOutflows()", () => {
    it("should return undefined when outflows.json does not exist", () => {
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);
      expect(result).toBeUndefined();
    });

    it("should return data when outflows.json exists", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000",
            events: [],
          },
        },
      };

      // Write file directly to simulate existing data
      const distributorDir = path.join("store", "distributors", VALID_ADDRESS);
      fs.mkdirSync(distributorDir, { recursive: true });
      fs.writeFileSync(
        path.join(distributorDir, "outflows.json"),
        JSON.stringify(testData, null, 2),
      );

      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);
      expect(result).toEqual(testData);
    });

    it("should not create default data with address when file doesn't exist", () => {
      // The current implementation creates default data using the address parameter
      // After refactoring, it should return undefined instead
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      // Currently this returns default data, but should return undefined
      expect(result).toBeUndefined();
    });
  });
});
