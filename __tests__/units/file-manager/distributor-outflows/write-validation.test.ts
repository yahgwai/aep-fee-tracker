import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_ADDRESS_LOWERCASE,
  INVALID_ADDRESS,
  VALID_TX_HASH,
  MAX_UINT256,
  TestContext,
} from "../test-utils";
import { OutflowData, CHAIN_IDS } from "../../../../src/types";

describe("FileManager - Distributor Outflows - Write Validation", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeDistributorOutflows() - Address Validation", () => {
    it("should validate address is checksummed", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
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

      // Should automatically checksum the address
      testContext.fileManager.writeDistributorOutflows(
        VALID_ADDRESS_LOWERCASE,
        testData,
      );

      // Verify file was created with checksummed address
      const fs = require("fs");
      expect(
        fs.existsSync(`store/distributors/${VALID_ADDRESS}/outflows.json`),
      ).toBe(true);
    });

    it("should validate reward_distributor matches the address parameter", () => {
      const differentAddress = INVALID_ADDRESS;

      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
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

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/address mismatch/);
    });

    it("should validate recipient addresses are checksummed", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [
              {
                recipient: "0xaaa1234567890123456789012345678901234567", // lowercase
                value_wei: "1000000000000000000000",
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/address.*checksum/i);
    });
  });

  describe("writeDistributorOutflows() - Date and Block Validation", () => {
    it("should validate date formats in outflows", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "01/15/2024": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Invalid date format/);
    });

    it("should validate block numbers are positive", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: -1,
            total_outflow_wei: "1000000000000000000000",
            events: [],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/positive integer/);
    });
  });

  describe("writeDistributorOutflows() - Wei Value Validation", () => {
    it("should reject negative total_outflow_wei values", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "-1000",
            events: [],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Non-negative decimal string/);
    });

    it("should reject event value_wei in scientific notation", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1230000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1.23e+21",
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Invalid numeric format/);
    });

    it("should use validateWeiValue with context for total_outflow_wei", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1e18", // Scientific notation
            events: [],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(
        `Invalid numeric format\n` +
          `  Field: total_outflow_wei\n` +
          `  Date: 2024-01-15\n` +
          `  Value: 1e18\n` +
          `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
      );
    });

    it("should use validateWeiValue with context for event value_wei", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000",
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "1.0e18", // Scientific notation
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(
        `Invalid numeric format\n` +
          `  Field: event.value_wei\n` +
          `  Date: 2024-01-15\n` +
          `  Value: 1.0e18\n` +
          `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
      );
    });

    it("should handle maximum uint256 outflow values", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: MAX_UINT256,
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: MAX_UINT256,
                tx_hash: VALID_TX_HASH,
              },
            ],
          },
        },
      };

      testContext.fileManager.writeDistributorOutflows(VALID_ADDRESS, testData);
      const result =
        testContext.fileManager.readDistributorOutflows(VALID_ADDRESS);

      expect(result?.outflows["2024-01-15"]?.total_outflow_wei).toBe(
        MAX_UINT256,
      );
      expect(result?.outflows["2024-01-15"]?.events[0]?.value_wei).toBe(
        MAX_UINT256,
      );
    });
  });

  describe("writeDistributorOutflows() - Transaction Hash Validation", () => {
    it("should validate transaction hashes format", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
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
                tx_hash: "0xinvalid", // invalid tx hash
              },
            ],
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Invalid transaction hash/);
    });

    it("should use validateTransactionHash for tx_hash validation", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
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

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(
        /Invalid transaction hash format.*Expected 0x followed by 64 hexadecimal characters/,
      );
    });
  });

  describe("writeDistributorOutflows() - Business Logic Validation", () => {
    it("should validate total_outflow_wei matches sum of events", () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000", // total is 1000
            events: [
              {
                recipient: "0xAaa1234567890123456789012345678901234567",
                value_wei: "500000000000000000000", // 500
                tx_hash: VALID_TX_HASH,
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

      expect(() =>
        testContext.fileManager.writeDistributorOutflows(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Total outflow mismatch/);
    });
  });
});
