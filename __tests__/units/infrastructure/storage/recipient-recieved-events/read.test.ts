import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import { getAddress } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  VALID_ADDRESS,
  VALID_TX_HASH,
  TestContext,
} from "../test-utils";
import { RecipientRecievedEventData } from "../../../../../src/types";
import { CHAIN_IDS } from "../../../../../src/constants";

describe("FileManager - Recipient Recieved Events - Read Operations", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("readRecipientRecievedEvents()", () => {
    it("should return undefined when recipient-recieved-events.json does not exist", () => {
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      expect(result).toBeUndefined();
    });

    it("should create distributor directory when writing events for new address", () => {
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
              value: "1000000000000000000",
            },
        },
      };

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(false);

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );

      expect(fs.existsSync(`store/distributors/${VALID_ADDRESS}`)).toBe(true);
      expect(
        fs.existsSync(
          `store/distributors/${VALID_ADDRESS}/recipient-recieved-events.json`,
        ),
      ).toBe(true);
    });

    it("should write and read back RecipientRecievedEventData with multiple events", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12356789,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 12345678,
              transactionHash:
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              logIndex: 0,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000aaa1234567890123456789012345678901234567",
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0xAaa1234567890123456789012345678901234567",
              value: "1000000000000000000",
            },
          "0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef:1":
            {
              blockNumber: 12345679,
              transactionHash:
                "0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef",
              logIndex: 1,
              address: VALID_ADDRESS,
              topics: [
                "0x123456789abcdef0",
                "0x000000000000000000000000bbb2345678901234567890123456789012345678",
              ],
              data: "0x00000000000000000000000000000000000000000000000015af1d78b58c40000",
              recipient: "0xbbB2345678901234567890123456789012345678",
              value: "2500000000000000000000",
            },
        },
      };

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      expect(result).toEqual(testData);
    });

    it("should handle event data with no events", () => {
      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345678,
        },
        events: {},
      };

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      expect(result).toEqual(testData);
    });

    it("should handle many events with different transaction hashes and log indices", () => {
      const events: RecipientRecievedEventData["events"] = {};

      // Create 20 events with various transaction hashes and log indices
      // Use properly checksummed addresses for recipients
      const recipients = [
        getAddress("0x0000000000000000000000000000000000000000"),
        getAddress("0x0000000000000000000000000000000000000001"),
        getAddress("0x0000000000000000000000000000000000000002"),
        getAddress("0x0000000000000000000000000000000000000003"),
        getAddress("0x0000000000000000000000000000000000000004"),
        getAddress("0x0000000000000000000000000000000000000005"),
        getAddress("0x0000000000000000000000000000000000000006"),
        getAddress("0x0000000000000000000000000000000000000007"),
        getAddress("0x0000000000000000000000000000000000000008"),
        getAddress("0x0000000000000000000000000000000000000009"),
        getAddress("0x000000000000000000000000000000000000000a"),
        getAddress("0x000000000000000000000000000000000000000b"),
        getAddress("0x000000000000000000000000000000000000000c"),
        getAddress("0x000000000000000000000000000000000000000d"),
        getAddress("0x000000000000000000000000000000000000000e"),
        getAddress("0x000000000000000000000000000000000000000f"),
        getAddress("0x0000000000000000000000000000000000000010"),
        getAddress("0x0000000000000000000000000000000000000011"),
        getAddress("0x0000000000000000000000000000000000000012"),
        getAddress("0x0000000000000000000000000000000000000013"),
      ];

      for (let i = 0; i < 20; i++) {
        const txHash = `0x${i.toString(16).padStart(64, "0")}`;
        const logIndex = i % 5; // Some transactions have multiple events
        const key = `${txHash}:${logIndex}`;

        events[key] = {
          blockNumber: 12345678 + Math.floor(i / 5),
          transactionHash: txHash,
          logIndex: logIndex,
          address: VALID_ADDRESS,
          topics: [
            "0x123456789abcdef0",
            `0x000000000000000000000000${recipients[i]!.slice(2).toLowerCase()}`,
          ],
          data: `0x${(BigInt(1000 + i) * BigInt(10) ** BigInt(18)).toString(16).padStart(64, "0")}`,
          recipient: recipients[i]!,
          value: `${1000 + i}000000000000000000`,
        };
      }

      const testData: RecipientRecievedEventData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: VALID_ADDRESS,
          last_scanned_block: 12345698,
        },
        events: events,
      };

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      expect(result).toEqual(testData);
      expect(Object.keys(result?.events || {}).length).toBe(20);
    });

    it("should preserve value strings without modification", () => {
      const exactValue = "1234567890123456789012345678901234567890";

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
              value: exactValue,
            },
        },
      };

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      const eventKey = Object.keys(result?.events || {})[0];
      expect(result?.events[eventKey!]?.value).toBe(exactValue);
      expect(typeof result?.events[eventKey!]?.value).toBe("string");
    });

    it("should handle events with value of 0 correctly", () => {
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

      testContext.fileManager.writeRecipientRecievedEvents(
        VALID_ADDRESS,
        testData,
      );
      const result =
        testContext.fileManager.readRecipientRecievedEvents(VALID_ADDRESS);

      const eventKey = Object.keys(result?.events || {})[0];
      expect(result?.events[eventKey!]?.value).toBe("0");
    });
  });
});
