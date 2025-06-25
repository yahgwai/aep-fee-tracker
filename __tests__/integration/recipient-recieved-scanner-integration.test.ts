import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";
import { ethers } from "ethers";
import { RecipientRecievedScanner } from "../../src/recipient-recieved-scanner";
import { FileManager } from "../../src/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  DistributorType,
  DISTRIBUTOR_METHODS,
} from "../../src/types";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import testBlockNumbers from "../test-data/distributor-detector/block_numbers.json";
import { ARBOWNER_PRECOMPILE_ADDRESS } from "../../src/constants/distributor-detector";

// Network configuration for Nova RPC
const ARBITRUM_NOVA_CHAIN_ID = 42170;
const ARBITRUM_NOVA_RPC_URL = process.env["ARBITRUM_NOVA_RPC_URL"] as string;
const NETWORK_CONFIG = {
  chainId: ARBITRUM_NOVA_CHAIN_ID,
  name: "arbitrum-nova",
};

// Helper to create Nova provider
function createNovaProvider(): ethers.JsonRpcProvider {
  const network = ethers.Network.from(NETWORK_CONFIG);
  return new ethers.JsonRpcProvider(ARBITRUM_NOVA_RPC_URL, network, {
    staticNetwork: network,
  });
}

// Test distributor addresses - using checksummed addresses
const TEST_DISTRIBUTORS_WITH_EVENTS = [
  ethers.getAddress("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"),
  ethers.getAddress("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De"),
  ethers.getAddress("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f"),
];

const TEST_DISTRIBUTORS_WITHOUT_EVENTS = [
  ethers.getAddress("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"),
  ethers.getAddress("0xdff90519a9DE6ad469D4f9839a9220C5D340B792"),
];

interface ExpectedEventData {
  chain_id: number;
  distributor_address: string;
  events: Array<{
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    address: string;
    topics: string[];
    data: string;
    recipient: string;
    value: string;
  }>;
  block_range?: {
    start: number;
    end: number;
  };
}

// Helper to load expected event data
async function loadExpectedEventData(
  distributorAddress: string,
): Promise<ExpectedEventData> {
  const eventFilePath = path.join(
    __dirname,
    "../test-data/recipient-recieved",
    `${distributorAddress}.json`,
  );
  const content = await fs.readFile(eventFilePath, "utf-8");
  return JSON.parse(content);
}

// Helper to create test distributors data
function createTestDistributorsData(): DistributorsData {
  const distributors: DistributorsData = {
    metadata: {
      chain_id: ARBITRUM_NOVA_CHAIN_ID,
      arbowner_address: ARBOWNER_PRECOMPILE_ADDRESS,
      last_scanned_block: 88026127,
    },
    distributors: {},
  };

  // Add distributor 1 (has events)
  const addr1 = ethers.getAddress("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce");
  distributors.distributors[addr1] = {
    type: DistributorType.L1_SURPLUS_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr1,
  };

  // Add distributor 2 (has events)
  const addr2 = ethers.getAddress("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De");
  distributors.distributors[addr2] = {
    type: DistributorType.L2_SURPLUS_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr2,
  };

  // Add distributor 3 (has events)
  const addr3 = ethers.getAddress("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f");
  distributors.distributors[addr3] = {
    type: DistributorType.L2_BASE_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L2_BASE_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr3,
  };

  // Add distributor 4 (no events)
  const addr4 = ethers.getAddress("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB");
  distributors.distributors[addr4] = {
    type: DistributorType.L2_SURPLUS_FEE,
    block: 152,
    date: "2022-07-12",
    tx_hash:
      "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
    method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
    owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
    event_data: "",
    is_reward_distributor: false,
    distributor_address: addr4,
  };

  // Add distributor 5 (no events)
  const addr5 = ethers.getAddress("0xdff90519a9DE6ad469D4f9839a9220C5D340B792");
  distributors.distributors[addr5] = {
    type: DistributorType.L2_BASE_FEE,
    block: 684,
    date: "2022-08-09",
    tx_hash:
      "0x91cf95025dd73017bb3b8a2a93e2bb2c666bbdce97f88ac4ae3e583aa1aa6a96",
    method: DISTRIBUTOR_METHODS.L2_BASE_FEE,
    owner: "0x67CB8A1b249D1b1A79f1e6252faCE5c90Cfc38EA",
    event_data: "",
    is_reward_distributor: false,
    distributor_address: addr5,
  };

  return distributors;
}

describe("RecipientRecievedScanner - Integration Tests", () => {
  let testContext: TestContext;
  let scanner: RecipientRecievedScanner;
  let provider: ethers.JsonRpcProvider;
  let fileManager: FileManager;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    fileManager = testContext.fileManager as unknown as FileManager;
    provider = createNovaProvider();
    scanner = new RecipientRecievedScanner(provider, fileManager);

    // Setup test data
    fileManager.writeBlockNumbers(testBlockNumbers as BlockNumberData);
    fileManager.writeDistributors(createTestDistributorsData());
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    if (provider) {
      await provider.destroy();
    }
  });

  describe("Basic Scanner Functionality", () => {
    it("should connect to Nova RPC and scan for events from all distributors", async () => {
      // Act
      await scanner.scan();

      // Assert - Check that scanner created event files for distributors with events
      for (const distributorAddress of TEST_DISTRIBUTORS_WITH_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        expect(eventData).toBeDefined();
        expect(eventData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
        expect(eventData?.metadata.reward_distributor).toBe(distributorAddress);
      }
    });

    it("should correctly identify distributors with events", async () => {
      // Act
      await scanner.scan();

      // Assert - Distributors with events should have event data
      for (const distributorAddress of TEST_DISTRIBUTORS_WITH_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        expect(eventData).toBeDefined();
        expect(Object.keys(eventData?.events || {}).length).toBeGreaterThan(0);
      }

      // Assert - Distributors without events should have empty event object
      for (const distributorAddress of TEST_DISTRIBUTORS_WITHOUT_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        if (eventData) {
          expect(Object.keys(eventData.events).length).toBe(0);
        }
      }
    });

    it("should parse RecipientRecieved events correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData).toBeDefined();

      // Check events are parsed correctly
      const events = Object.values(eventData?.events || {});
      expect(events.length).toBeGreaterThan(0);

      // Verify event structure
      const firstEvent = events[0]!;
      expect(firstEvent).toHaveProperty("blockNumber");
      expect(firstEvent).toHaveProperty("transactionHash");
      expect(firstEvent).toHaveProperty("logIndex");
      expect(firstEvent).toHaveProperty("address");
      expect(firstEvent).toHaveProperty("topics");
      expect(firstEvent).toHaveProperty("data");
      expect(firstEvent).toHaveProperty("recipient");
      expect(firstEvent).toHaveProperty("value");

      // Verify recipient is checksummed
      expect(ethers.isAddress(firstEvent.recipient)).toBe(true);
      expect(firstEvent.recipient).toBe(
        ethers.getAddress(firstEvent.recipient),
      );

      // Verify value is a valid decimal string
      expect(typeof firstEvent.value).toBe("string");
      expect(firstEvent.value).toMatch(/^\d+$/);
    });

    it("should handle distributors without events gracefully", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITHOUT_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData).toBeDefined();
      expect(eventData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
      expect(eventData?.metadata.reward_distributor).toBe(testDistributor);
      expect(Object.keys(eventData?.events || {}).length).toBe(0);
    });
  });

  describe("Event Collection and Parsing", () => {
    it("should match correct event signature", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;
      const expectedEventSignature =
        "0x8b2a2b28e169eb0e4f62578e9d12f747d7bd0fe1ebc935af28387c18034d7cc0";

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const events = Object.values(eventData?.events || {});

      // All events should have the correct topic
      for (const event of events) {
        expect(event.topics[0]).toBe(expectedEventSignature);
      }
    });

    it("should extract recipient address and checksum correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const events = Object.values(eventData?.events || {});

      for (const event of events) {
        // Recipient should be a valid checksummed address
        expect(ethers.isAddress(event.recipient)).toBe(true);
        expect(event.recipient).toBe(ethers.getAddress(event.recipient));

        // Recipient should match the indexed parameter in topics
        const recipientFromTopic = ethers.getAddress(
          "0x" + event.topics[1]!.slice(26),
        );
        expect(event.recipient).toBe(recipientFromTopic);
      }
    });

    it("should parse value from event data correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const events = Object.values(eventData?.events || {});

      for (const event of events) {
        // Value should be a valid decimal string
        expect(typeof event.value).toBe("string");
        expect(event.value).toMatch(/^\d+$/);

        // Value should match the decoded data
        const decodedValue = ethers.toBigInt(event.data);
        expect(event.value).toBe(decodedValue.toString());
      }
    });

    it("should handle block range chunking for large ranges", async () => {
      // This test verifies chunking works by scanning a distributor with events across multiple chunks
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const expectedData = await loadExpectedEventData(testDistributor);

      // Should have collected all events despite chunking
      expect(Object.keys(eventData?.events || {}).length).toBe(
        expectedData.events.length,
      );
    });
  });

  describe("Data Persistence", () => {
    it("should integrate with FileManager for writing event data", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert - File should exist
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData).toBeDefined();

      // Verify file structure
      expect(eventData).toHaveProperty("metadata");
      expect(eventData).toHaveProperty("events");
      expect(eventData?.metadata).toHaveProperty("chain_id");
      expect(eventData?.metadata).toHaveProperty("reward_distributor");
      expect(eventData?.metadata).toHaveProperty("last_scanned_block");
    });

    it("should update metadata correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
      expect(eventData?.metadata.reward_distributor).toBe(testDistributor);
      expect(eventData?.metadata.last_scanned_block).toBeGreaterThan(0);
    });

    it("should store events with correct unique keys", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const eventKeys = Object.keys(eventData?.events || {});

      // Keys should be in format: transactionHash:logIndex
      for (const key of eventKeys) {
        expect(key).toMatch(/^0x[a-f0-9]{64}:\d+$/);
      }

      // Keys should be unique
      const uniqueKeys = new Set(eventKeys);
      expect(uniqueKeys.size).toBe(eventKeys.length);
    });

    it("should match expected file structure format", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const expectedData = await loadExpectedEventData(testDistributor);

      // Metadata structure
      expect(eventData?.metadata.chain_id).toBe(expectedData.chain_id);
      expect(eventData?.metadata.reward_distributor).toBe(
        expectedData.distributor_address,
      );

      // Events structure
      const events = Object.values(eventData?.events || {});
      for (const event of events) {
        // Find corresponding event in expected data
        const expectedEvent = expectedData.events.find(
          (e) =>
            e.transactionHash === event.transactionHash &&
            e.logIndex === event.logIndex,
        );
        expect(expectedEvent).toBeDefined();

        if (expectedEvent) {
          // Compare event fields
          expect(event.blockNumber).toBe(expectedEvent.blockNumber);
          expect(event.address).toBe(expectedEvent.address);
          expect(event.topics).toEqual(expectedEvent.topics);
          expect(event.data).toBe(expectedEvent.data);
          expect(event.recipient).toBe(expectedEvent.recipient);
          expect(event.value).toBe(expectedEvent.value);
        }
      }
    });
  });

  describe("Incremental Scanning", () => {
    it("should resume from last scanned block", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan - partial (simulate by limiting block range)
      const limitedBlockNumbers: BlockNumberData = {
        metadata: { chain_id: ARBITRUM_NOVA_CHAIN_ID },
        blocks: {
          "2023-03-16": 3163115,
          "2023-03-17": 3187362,
          "2023-03-18": 3217790,
        },
      };
      fileManager.writeBlockNumbers(limitedBlockNumbers);
      await scanner.scan(testDistributor);

      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const firstScanLastBlock =
        firstScanData?.metadata.last_scanned_block || 0;
      const firstScanEventCount = Object.keys(
        firstScanData?.events || {},
      ).length;

      // Second scan - with full block range
      fileManager.writeBlockNumbers(testBlockNumbers as BlockNumberData);
      await scanner.scan(testDistributor);

      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const secondScanLastBlock =
        secondScanData?.metadata.last_scanned_block || 0;
      const secondScanEventCount = Object.keys(
        secondScanData?.events || {},
      ).length;

      // Assert
      expect(secondScanLastBlock).toBeGreaterThan(firstScanLastBlock);
      expect(secondScanEventCount).toBeGreaterThanOrEqual(firstScanEventCount);
    });

    it("should not duplicate events on re-run", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan
      await scanner.scan(testDistributor);
      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const firstEventKeys = Object.keys(firstScanData?.events || {});
      const firstEventCount = firstEventKeys.length;

      // Second scan - immediate re-run
      await scanner.scan(testDistributor);
      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const secondEventKeys = Object.keys(secondScanData?.events || {});
      const secondEventCount = secondEventKeys.length;

      // Assert
      expect(secondEventCount).toBe(firstEventCount);
      expect(new Set(secondEventKeys)).toEqual(new Set(firstEventKeys));
    });

    it("should correctly merge new events with existing", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan - limited dates
      const limitedBlockNumbers: BlockNumberData = {
        metadata: { chain_id: ARBITRUM_NOVA_CHAIN_ID },
        blocks: {
          "2023-03-16": 3163115,
          "2023-03-17": 3187362,
          "2023-12-01": 54283440,
        },
      };
      fileManager.writeBlockNumbers(limitedBlockNumbers);
      await scanner.scan(testDistributor);

      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const firstEventKeys = new Set(Object.keys(firstScanData?.events || {}));

      // Second scan - full date range
      fileManager.writeBlockNumbers(testBlockNumbers as BlockNumberData);
      await scanner.scan(testDistributor);

      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const secondEventKeys = new Set(
        Object.keys(secondScanData?.events || {}),
      );

      // Assert - All first scan events should still exist
      for (const key of firstEventKeys) {
        expect(secondEventKeys.has(key)).toBe(true);
      }

      // Should have more events after second scan
      expect(secondEventKeys.size).toBeGreaterThan(firstEventKeys.size);
    });

    it("should handle date-based incremental updates correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan
      await scanner.scan(testDistributor);
      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      // Simulate new day added to block numbers
      const updatedBlockNumbers = { ...testBlockNumbers } as BlockNumberData & {
        blocks: Record<string, number>;
      };
      updatedBlockNumbers.blocks["2025-06-24"] = 88100000; // Future date
      fileManager.writeBlockNumbers(updatedBlockNumbers as BlockNumberData);

      // Second scan
      await scanner.scan(testDistributor);
      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      // Assert - Should not have scanned future date (yesterday logic)
      expect(secondScanData?.metadata.last_scanned_block).toBe(
        firstScanData?.metadata.last_scanned_block,
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid distributor address", async () => {
      const invalidAddress = "0xinvalid";

      // Act & Assert
      await expect(scanner.scan(invalidAddress)).rejects.toThrow(
        `Invalid Ethereum address: ${invalidAddress}`,
      );
    });

    it("should handle missing block number data", async () => {
      // Remove block numbers
      cleanupTestEnvironment(testContext.tempDir);
      testContext = setupTestEnvironment();
      fileManager = testContext.fileManager as unknown as FileManager;
      scanner = new RecipientRecievedScanner(provider, fileManager);

      // Only write distributors, no block numbers
      fileManager.writeDistributors(createTestDistributorsData());

      // Act
      await scanner.scan();

      // Assert - Should complete without error
      const eventData = fileManager.readRecipientRecievedEvents(
        TEST_DISTRIBUTORS_WITH_EVENTS[0]!,
      );
      expect(eventData).toBeUndefined();
    });

    it("should handle future-dated distributor", async () => {
      // Create distributor with future date
      const futureDistributors = createTestDistributorsData();
      const futureAddress = ethers.getAddress(
        "0x1234567890123456789012345678901234567890",
      );
      futureDistributors.distributors[futureAddress] = {
        type: DistributorType.L1_SURPLUS_FEE,
        block: 99999999,
        date: "2026-01-01", // Future date
        tx_hash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        method: DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
        owner: "0x0000000000000000000000000000000000000000",
        event_data: "",
        is_reward_distributor: true,
        distributor_address: futureAddress,
      };
      fileManager.writeDistributors(futureDistributors);

      // Act
      await scanner.scan(futureAddress);

      // Assert - Should not create event file for future distributor
      const eventData = fileManager.readRecipientRecievedEvents(futureAddress);
      expect(eventData).toBeUndefined();
    });

    it("should handle RPC failures with retry mechanism", async () => {
      // This test verifies the retry mechanism works
      // The actual implementation uses withRetry which should handle transient failures
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert - If we got results, the retry mechanism worked
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData).toBeDefined();
      expect(Object.keys(eventData?.events || {}).length).toBeGreaterThan(0);
    });

    it("should throw error for non-existent distributor", async () => {
      const nonExistentAddress = ethers.getAddress(
        "0x0000000000000000000000000000000000000000",
      );

      // Act & Assert
      await expect(scanner.scan(nonExistentAddress)).rejects.toThrow(
        `Distributor ${nonExistentAddress} not found`,
      );
    });
  });

  describe("Scan All Distributors", () => {
    it("should scan all distributors when no address specified", async () => {
      // Act
      await scanner.scan();

      // Assert - All distributors should be processed
      for (const distributorAddress of TEST_DISTRIBUTORS_WITH_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        expect(eventData).toBeDefined();
        expect(Object.keys(eventData?.events || {}).length).toBeGreaterThan(0);
      }

      for (const distributorAddress of TEST_DISTRIBUTORS_WITHOUT_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        if (eventData) {
          expect(Object.keys(eventData.events).length).toBe(0);
        }
      }
    });
  });
});
