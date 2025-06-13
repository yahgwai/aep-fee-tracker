import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_TX_HASH,
  TestContext,
} from "../test-utils";
import { OutflowData, OutflowEvent, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Outflows - Read Operations", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readDistributorOutflows()", () => {
    it("should return empty OutflowData when outflows.json does not exist", () => {
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result).toEqual({
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {},
      });
    });

    it("should create distributor directory when writing outflows for new address", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1500000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1500000000000000000000",
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(false);

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(true);
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/outflows.json`),
      ).toBe(true);
    });

    it("should write and read back OutflowData with multiple dates", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
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
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result).toEqual(testData);
    });

    it("should handle outflows with no events", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: [],
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result).toEqual(testData);
    });

    it("should handle multiple events on the same day", () => {
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
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: totalWei.toString(),
            events: events,
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result).toEqual(testData);
      expect(result.outflows["2024-01-15"]?.events.length).toBe(10);
    });

    it("should preserve wei values as strings without modification", () => {
      const exactWeiValue = "1234567890123456789012345678901234567890";

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: exactWeiValue,
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: exactWeiValue,
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

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

    it("should handle outflow value of 0 correctly", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: [],
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result.outflows["2024-01-15"]?.total_outflow_wei).toBe("0");
    });
  });
});
