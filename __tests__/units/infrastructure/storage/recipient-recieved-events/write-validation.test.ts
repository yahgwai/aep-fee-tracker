import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_ADDRESS_LOWERCASE,
  INVALID_ADDRESS,
  VALID_TX_HASH,
  TestContext,
} from "../test-utils";
import { RecipientRecievedEventData } from "../../../../../src/types";
import { CHAIN_IDS } from "../../../../../src/constants";

describe("FileManager - Recipient Recieved Events - Write Validation", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("writeRecipientRecievedEvents() - Address Validation", () => {
    it("should validate address is checksummed", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {},
      };

      // Should automatically checksum the address
      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS_LOWERCASE,
        testData,
      );

      // Verify file was created with checksummed address
      const fs = require("fs");
      expect(
        fs.existsSync(
          `store/distributors/${VALID_ADDRESS}/recipient-recieved-events.json`,
        ),
      ).toBe(true);
    });

    it("should validate reward_distributor matches the address parameter", () => {
      const differentAddress = INVALID_ADDRESS;

      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: differentAddress,
          last_scanned_block: 12345678,
        },
        events: {},
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/address mismatch/);
    });

    it("should validate recipient addresses are checksummed", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xaaa1234567890123456789012345678901234567", // lowercase
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/address.*checksum/i);
    });

    it("should validate event address (contract) is checksummed", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9", // lowercase
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/address.*checksum/i);
    });
  });

  describe("writeRecipientRecievedEvents() - Block and Transaction Validation", () => {
    it("should validate block numbers are positive", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: -1,
        },
        events: {},
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/positive integer/);
    });

    it("should validate event block numbers are positive", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: -1,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/positive integer/);
    });

    it("should validate transaction hash format", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "invalid-hash:0": {
            blockNumber: 12345678,
            transactionHash: "invalid-hash",
            logIndex: 0,
            address: VALID_ADDRESS,
            topics: [
              "0x123456789abcdef0",
              "0x000000000000000000000000aaa1234567890123456789012345678901234567",
            ],
            data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
            recipient: "0xAaa1234567890123456789012345678901234567",
            value: "1000000000000000000000",
          },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/transaction hash format/);
    });

    it("should validate log index is non-negative", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:-1":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: -1,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/non-negative integer/);
    });
  });

  describe("writeRecipientRecievedEvents() - Value Validation", () => {
    it("should reject negative value", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "-1000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Non-negative decimal string/);
    });

    it("should reject value in scientific notation", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1.23e+21",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Invalid numeric format/);
    });

    it("should reject value with decimal points", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000.5",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Integer string/);
    });

    it("should accept value of 0", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000000000000000000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "0",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).not.toThrow();
    });
  });

  describe("writeRecipientRecievedEvents() - Event Key Validation", () => {
    it("should validate event key format matches transactionHash:logIndex", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash:
                "0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef", // Different from key
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Event key.*mismatch/);
    });

    it("should validate event key logIndex matches", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash: VALID_TX_HASH,
              logIndex: 1, // Different from key
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000000",
            },
        },
      };

      expect(() =>
        testContext.fileManager.writeRecipientRecievedEvents(
          VALID_ADDRESS,
          testData,
        ),
      ).toThrow(/Event key.*mismatch/);
    });
  });
});
