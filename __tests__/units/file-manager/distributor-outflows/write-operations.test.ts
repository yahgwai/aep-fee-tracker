import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  TestContext,
} from "../test-utils";
import { OutflowData, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Outflows - Write Operations", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeDistributorOutflows() - File Operations", () => {
    it("should create store directory if it does not exist", async () => {
      expect(fs.existsSync("store")).toBe(false);

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {},
      };

      await testContext.fileManager.writeDistributorOutflows(
        VALID_ADDRESS,
        testData,
      );

      expect(fs.existsSync("store")).toBe(true);
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/outflows.json`),
      ).toBe(true);
    });

    it("should format JSON with 2-space indentation", async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
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

      await testContext.fileManager.writeDistributorOutflows(
        VALID_ADDRESS,
        testData,
      );

      const filePath = `store/distributors/${VALID_ADDRESS}/outflows.json`;
      const fileContent = fs.readFileSync(filePath, "utf-8");

      expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    });
  });
});
