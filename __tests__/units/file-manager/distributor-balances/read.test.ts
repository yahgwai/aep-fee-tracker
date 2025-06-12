import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  TestContext,
} from "../test-utils";
import { BalanceData, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Balances - Read Operations", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readDistributorBalances()", () => {
    it("should return empty BalanceData when balances.json does not exist", async () => {
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {},
      });
    });

    it("should create distributor directory when writing balances for new address", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1234567890123456789012",
          },
        },
      };

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(false);

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        testData,
      );

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
        balances: {
          "2024-01-01": {
            block_number: 100000,
            balance_wei: "1000000000000000000000",
          },
          "2024-01-02": {
            block_number: 200000,
            balance_wei: "2000000000000000000000",
          },
          "2024-01-03": {
            block_number: 300000,
            balance_wei: "3000000000000000000000",
          },
          "2024-01-04": {
            block_number: 400000,
            balance_wei: "4000000000000000000000",
          },
          "2024-01-05": {
            block_number: 500000,
            balance_wei: "5000000000000000000000",
          },
        },
      };

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        testData,
      );
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result).toEqual(testData);
      expect(Object.keys(result.balances).length).toBe(5);
    });

    it("should preserve wei values as strings without modification", async () => {
      const exactWeiValue =
        "123456789012345678901234567890123456789012345678901234567890";

      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: exactWeiValue,
          },
        },
      };

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        testData,
      );
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe(exactWeiValue);
      expect(typeof result.balances["2024-01-15"]?.balance_wei).toBe("string");
    });

    it("should handle balance of 0 correctly", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "0",
          },
        },
      };

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        testData,
      );
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe("0");
    });

    it("should update existing balance file with new dates", async () => {
      const initialData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        initialData,
      );

      // Add a new date to the existing data
      const updatedData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
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

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        updatedData,
      );
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(Object.keys(result.balances).length).toBe(2);
      expect(result.balances["2024-01-15"]?.balance_wei).toBe(
        "1000000000000000000000",
      );
      expect(result.balances["2024-01-16"]?.balance_wei).toBe(
        "2000000000000000000000",
      );
    });
  });
});
