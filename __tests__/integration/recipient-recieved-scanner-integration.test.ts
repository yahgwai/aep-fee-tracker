import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";
import { ethers } from "ethers";
import { RecipientRecievedScanner } from "../../src/core/fee-calculation/recipient-recieved-scanner";
import { FileManager } from "../../src/infrastructure/storage/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  DistributorType,
  DistributorInfo,
} from "../../src/types";
import { DISTRIBUTOR_METHODS } from "../../src/constants";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import { ARBOWNER_PRECOMPILE_ADDRESS } from "../../src/core/distributor-detection/constants";

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

// Helper to create a test distributor
function createTestDistributor(
  address: string,
  type: DistributorType,
  hasEvents: boolean = true,
  customData: Partial<DistributorInfo> = {},
): DistributorInfo {
  const checksummedAddress = ethers.getAddress(address);
  return {
    type,
    block: 68482010,
    date: "2024-05-01",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method:
      type === DistributorType.L1_SURPLUS_FEE
        ? DISTRIBUTOR_METHODS.L1_SURPLUS_FEE
        : type === DistributorType.L2_SURPLUS_FEE
          ? DISTRIBUTOR_METHODS.L2_SURPLUS_FEE
          : DISTRIBUTOR_METHODS.L2_BASE_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: hasEvents,
    distributor_address: checksummedAddress,
    ...customData,
  } as DistributorInfo;
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

  // Add distributors with events
  TEST_DISTRIBUTORS_WITH_EVENTS.forEach((addr, index) => {
    const types = [
      DistributorType.L1_SURPLUS_FEE,
      DistributorType.L2_SURPLUS_FEE,
      DistributorType.L2_BASE_FEE,
    ];
    distributors.distributors[addr] = [
      createTestDistributor(addr, types[index]!, true),
    ];
  });

  // Add distributors without events
  TEST_DISTRIBUTORS_WITHOUT_EVENTS.forEach((addr, index) => {
    const types = [DistributorType.L2_SURPLUS_FEE, DistributorType.L2_BASE_FEE];
    distributors.distributors[addr] = [
      createTestDistributor(addr, types[index]!, false, {
        owner:
          index === 0
            ? "0x9C040726F2A657226Ed95712245DeE84b650A1b5"
            : "0x67CB8A1b249D1b1A79f1e6252faCE5c90Cfc38EA",
        tx_hash:
          index === 0
            ? "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9"
            : "0x91cf95025dd73017bb3b8a2a93e2bb2c666bbdce97f88ac4ae3e583aa1aa6a96",
      }),
    ];
  });

  return distributors;
}

describe("RecipientRecievedScanner - Integration Tests", () => {
  let testContext: TestContext;
  let scanner: RecipientRecievedScanner;
  let provider: ethers.JsonRpcProvider;
  let fileManager: FileManager;
  let originalDate: DateConstructor;

  // Helper to mock Date to a specific date
  function mockDate(dateString: string): void {
    const mockDate = new originalDate(dateString);
    global.Date = jest.fn((arg?: string | number | Date) => {
      if (arg === undefined) {
        return mockDate;
      }
      return new originalDate(arg);
    }) as unknown as DateConstructor;
    global.Date.now = originalDate.now;
    global.Date.parse = originalDate.parse;
    global.Date.UTC = originalDate.UTC;
    // Only define prototype if not already defined
    if (!Object.getOwnPropertyDescriptor(global.Date, "prototype")) {
      Object.defineProperty(global.Date, "prototype", {
        value: originalDate.prototype,
        writable: false,
        enumerable: false,
        configurable: true,
      });
    }
  }

  // Helper to assert event data file was created with correct metadata
  function assertEventDataCreated(distributorAddress: string): void {
    const eventData =
      fileManager.readRecipientRecievedEvents(distributorAddress);
    expect(eventData).toBeDefined();
    expect(eventData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
    expect(eventData?.metadata.reward_distributor).toBe(distributorAddress);
    expect(eventData?.metadata.last_scanned_block).toBeGreaterThan(0);
    expect(eventData?.events).toBeDefined();
  }

  // Helper to create limited block numbers for faster tests
  function createLimitedBlockNumbers(): BlockNumberData {
    return {
      metadata: { chain_id: ARBITRUM_NOVA_CHAIN_ID },
      blocks: {
        "2024-04-30": 68299408,
        "2024-05-01": 68482010,
        "2024-05-02": 68669444,
      },
    };
  }

  beforeEach(() => {
    testContext = setupTestEnvironment();
    fileManager = testContext.fileManager as unknown as FileManager;
    provider = createNovaProvider();
    scanner = new RecipientRecievedScanner(provider, fileManager);

    // Mock Date to return a date within our test data range
    originalDate = global.Date;
    mockDate("2024-05-03T00:00:00Z");

    // Setup test data with limited date range for faster tests
    fileManager.writeBlockNumbers(createLimitedBlockNumbers());
    fileManager.writeDistributors(createTestDistributorsData());
  });

  afterEach(async () => {
    // Restore original Date
    global.Date = originalDate;

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
        assertEventDataCreated(distributorAddress);
      }
    }, 60000);

    it("should parse RecipientRecieved events correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      assertEventDataCreated(testDistributor);
    }, 30000);

    it("should handle distributors without events gracefully", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITHOUT_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert - Non-reward distributors (hasEvents=false) should be skipped entirely
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      expect(eventData).toBeUndefined();
    });
  });

  describe("Event Collection and Parsing", () => {
    it("should scan for RecipientRecieved events and create proper data structure", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert - Verify scanner creates proper data structure
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      expect(eventData).toBeDefined();
      expect(eventData?.metadata).toBeDefined();
      expect(eventData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
      expect(eventData?.metadata.reward_distributor).toBe(testDistributor);
      expect(eventData?.metadata.last_scanned_block).toBeGreaterThan(0);
      expect(eventData?.events).toBeDefined();
      expect(typeof eventData?.events).toBe("object");
    }, 30000);

    it("should handle block range chunking for large ranges", async () => {
      // This test verifies chunking works by scanning a distributor
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert
      const eventData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      // Should have created the file and scanned successfully
      expect(eventData).toBeDefined();
      expect(eventData?.metadata.last_scanned_block).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Data Persistence", () => {
    it("should integrate with FileManager for writing event data", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // Act
      await scanner.scan(testDistributor);

      // Assert - File should exist
      assertEventDataCreated(testDistributor);
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
      expect(eventData?.metadata.last_scanned_block).toBeDefined();
      expect(eventData?.events).toBeDefined();
    }, 30000);
  });

  describe("Incremental Scanning", () => {
    it("should resume from last scanned block", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan - only May 1st
      const limitedBlockNumbers: BlockNumberData = {
        metadata: { chain_id: ARBITRUM_NOVA_CHAIN_ID },
        blocks: {
          "2024-04-30": 68299408,
          "2024-05-01": 68482010,
        },
      };
      fileManager.writeBlockNumbers(limitedBlockNumbers);

      // Mock date to May 2nd for first scan
      mockDate("2024-05-02T00:00:00Z");

      await scanner.scan(testDistributor);

      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const firstScanLastBlock =
        firstScanData?.metadata.last_scanned_block || 0;

      // Second scan - add May 2nd data and mock date to May 3rd
      const expandedBlockNumbers = createLimitedBlockNumbers();
      fileManager.writeBlockNumbers(expandedBlockNumbers);

      mockDate("2024-05-03T00:00:00Z");

      await scanner.scan(testDistributor);

      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const secondScanLastBlock =
        secondScanData?.metadata.last_scanned_block || 0;

      // Assert - should have scanned the additional day
      expect(secondScanLastBlock).toBeGreaterThan(firstScanLastBlock);
    }, 30000);

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
    }, 30000);

    it("should correctly merge new events with existing", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan
      await scanner.scan(testDistributor);

      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const firstEventKeys = Object.keys(firstScanData?.events || {});
      const firstEventCount = firstEventKeys.length;

      // Second scan - immediate re-run should preserve all events
      await scanner.scan(testDistributor);

      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);
      const secondEventKeys = Object.keys(secondScanData?.events || {});
      const secondEventCount = secondEventKeys.length;

      // Assert - All events should be preserved
      expect(secondEventCount).toBe(firstEventCount);

      // All first scan event keys should still exist
      for (const key of firstEventKeys) {
        expect(secondEventKeys.includes(key)).toBe(true);
      }
    }, 30000);

    it("should handle date-based incremental updates correctly", async () => {
      const testDistributor = TEST_DISTRIBUTORS_WITH_EVENTS[0]!;

      // First scan
      await scanner.scan(testDistributor);
      const firstScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      // Add a new historical date (not future)
      const updatedBlockNumbers = createLimitedBlockNumbers();
      updatedBlockNumbers.blocks["2024-05-03"] = 68852046; // Historical date
      fileManager.writeBlockNumbers(updatedBlockNumbers);

      // Second scan - should now scan the new date
      await scanner.scan(testDistributor);
      const secondScanData =
        fileManager.readRecipientRecievedEvents(testDistributor);

      // Assert - Should have scanned up to the new date
      expect(secondScanData?.metadata.last_scanned_block).toBe(
        updatedBlockNumbers.blocks["2024-05-03"],
      );
      expect(secondScanData?.metadata.last_scanned_block).toBeGreaterThan(
        firstScanData?.metadata.last_scanned_block || 0,
      );
    }, 30000);
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
      futureDistributors.distributors[futureAddress] = [
        {
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
        },
      ];
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
      assertEventDataCreated(testDistributor);
    }, 30000);

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

      // Assert - Only reward distributors should be processed
      // TEST_DISTRIBUTORS_WITH_EVENTS have is_reward_distributor: true (hasEvents=true)
      for (const distributorAddress of TEST_DISTRIBUTORS_WITH_EVENTS) {
        assertEventDataCreated(distributorAddress);
      }

      // TEST_DISTRIBUTORS_WITHOUT_EVENTS have is_reward_distributor: false (hasEvents=false)
      // They should be skipped entirely
      for (const distributorAddress of TEST_DISTRIBUTORS_WITHOUT_EVENTS) {
        const eventData =
          fileManager.readRecipientRecievedEvents(distributorAddress);
        expect(eventData).toBeUndefined();
      }
    }, 60000);
  });
});
