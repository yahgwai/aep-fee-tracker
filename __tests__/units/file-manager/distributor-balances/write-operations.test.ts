import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  TestContext,
} from "../test-utils";
import { BalanceData, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Balances - Write Operations", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeDistributorBalances() - File Operations", () => {
    it("should create store directory if it does not exist", () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {},
      };

      testContext.fileManager.writeDistributorBalances(VALID_ADDRESS, testData);

      expect(fs.existsSync("store")).toBe(true);
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/balances.json`),
      ).toBe(true);
    });

    it("should format JSON with 2-space indentation", () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1234567890123456789012",
          },
        },
      };

      testContext.fileManager.writeDistributorBalances(VALID_ADDRESS, testData);

      const filePath = `store/distributors/${VALID_ADDRESS}/balances.json`;
      const fileContent = fs.readFileSync(filePath, "utf-8");

      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });
  });
});
