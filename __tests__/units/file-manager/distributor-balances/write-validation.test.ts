import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_ADDRESS_LOWERCASE,
  INVALID_ADDRESS,
  MAX_UINT256,
  TestContext,
} from "../test-utils";
import { BalanceData, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Balances - Write Validation", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeDistributorBalances() - Address Validation", () => {
    it("should validate address is checksummed", async () => {
      const testData: BalanceData = {
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

      // Should automatically checksum the address
      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS_LOWERCASE,
        testData,
      );

      // Verify file was created with checksummed address
      const fs = require("fs");
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/balances.json`),
      ).toBe(true);
    });

    it("should validate reward_distributor matches the address parameter", async () => {
      const differentAddress = INVALID_ADDRESS;

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
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/address mismatch/);
    });
  });

  describe("writeDistributorBalances() - Date and Block Validation", () => {
    it("should validate date formats in balances", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "01/15/2024": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/Invalid date format/);
    });

    it("should validate block numbers are positive", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: -1,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/positive integer/);
    });
  });

  describe("writeDistributorBalances() - Wei Value Validation", () => {
    it("should reject negative wei values", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "-1000",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/Non-negative decimal string/);
    });

    it("should reject wei values in scientific notation", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1.23e+21",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/Invalid numeric format/);
    });

    it("should reject wei values with decimal points", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000.5",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
      ).rejects.toThrow(/Integer string \(no decimal points\)/);
    });

    it("should handle maximum uint256 wei values", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: MAX_UINT256,
          },
        },
      };

      await testContext.fileManager.writeDistributorBalances(
        VALID_ADDRESS,
        testData,
      );
      const result =
        await testContext.fileManager.readDistributorBalances(VALID_ADDRESS);

      expect(result.balances["2024-01-15"]?.balance_wei).toBe(MAX_UINT256);
    });

    it("should use validateWeiValue with proper context for balance validation", async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1.23e21",
          },
        },
      };

      await expect(
        testContext.fileManager.writeDistributorBalances(
          VALID_ADDRESS,
          testData,
        ),
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
