import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { DistributorDetector } from "../../src/distributor-detector";
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

describe("DistributorDetector - Integration Tests", () => {
  let testContext: TestContext;
  let distributorDetector: DistributorDetector;
  let provider: ethers.JsonRpcProvider;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = createNovaProvider();
    distributorDetector = new DistributorDetector(
      testContext.fileManager as unknown as FileManager,
      provider,
    );
  });

  afterEach(async () => {
    cleanupTestEnvironment(testContext.tempDir);
    if (provider) {
      await provider.destroy();
    }
  });

  describe("Complete Data Lifecycle", () => {
    it("should detect distributors from scratch with real FileManager and test data", async () => {
      // Step 1: Write block numbers to FileManager
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Step 2: Run initial detection up to July 13, 2022 (after first 2 distributors)
      const endDate1 = new Date("2022-07-13");
      const result1 = await distributorDetector.detectDistributors(endDate1);

      // Verify initial detection results
      expect(result1.metadata.chain_id).toBe(42170);
      expect(result1.metadata.arbowner_address).toBe(
        ARBOWNER_PRECOMPILE_ADDRESS,
      );
      expect(result1.metadata.last_scanned_block).toBe(189);

      // Same address (0x37da...) was set for both L2_SURPLUS_FEE and L1_SURPLUS_FEE
      // But distributors are keyed by address, so we only have one entry (the first one)
      expect(Object.keys(result1.distributors).length).toBe(1);

      // Verify distributors were found and parsed correctly
      expect(
        result1.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"],
      ).toMatchObject({
        type: DistributorType.L2_SURPLUS_FEE,
        block: 152,
        date: "2022-07-12",
        method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        is_reward_distributor: false,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });

      // Step 3: Verify data was persisted to disk
      const savedDistributors = testContext.fileManager.readDistributors();
      expect(savedDistributors).toEqual(result1);

      // Verify file exists on disk
      const distributorsPath = path.join(
        testContext.tempDir,
        "store",
        "distributors.json",
      );
      expect(fs.existsSync(distributorsPath)).toBe(true);
    });

    it("should perform incremental scanning across multiple calls", async () => {
      // Setup: Write block numbers
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Step 1: Initial scan up to July 12, 2022 (finds first distributor at block 152)
      const endDate1 = new Date("2022-07-12");
      const result1 = await distributorDetector.detectDistributors(endDate1);

      expect(result1.metadata.last_scanned_block).toBe(155);
      expect(Object.keys(result1.distributors).length).toBe(1);

      // Step 2: Incremental scan up to Aug 9, 2022 (finds L2_BASE_FEE at block 684)
      const endDate2 = new Date("2022-08-09");
      const result2 = await distributorDetector.detectDistributors(endDate2);

      expect(result2.metadata.last_scanned_block).toBe(3584);
      expect(Object.keys(result2.distributors).length).toBe(2);

      // Step 3: For efficiency, we'll test one more incremental scan with a smaller range
      // Add a custom date that's far enough to test chunking but not too far
      const customBlockNumbers = JSON.parse(JSON.stringify(testBlockNumbers));
      customBlockNumbers.blocks["2022-09-15"] = 53584; // 50,000 blocks past previous scan
      testContext.fileManager.writeBlockNumbers(
        customBlockNumbers as BlockNumberData,
      );

      const endDate3 = new Date("2022-09-15");
      const result3 = await distributorDetector.detectDistributors(endDate3);

      // Verify incremental scanning worked
      expect(result3.metadata.last_scanned_block).toBe(53584);
      // Should still have the same 2 distributors (no new ones in this range)
      expect(Object.keys(result3.distributors).length).toBe(2);

      // Verify the distributors from previous scans are preserved
      expect(result3.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(result3.distributors).toHaveProperty(
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
      );
    });

    it("should recover state correctly after process restart", async () => {
      // Setup: Write block numbers
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Step 1: Initial detection
      const endDate = new Date("2022-08-09");
      const result1 = await distributorDetector.detectDistributors(endDate);
      expect(Object.keys(result1.distributors).length).toBe(2);

      // Step 2: Simulate process restart with new instances
      const storePath = path.join(testContext.tempDir, "store");
      const newFileManager = new FileManager(storePath);
      const newProvider = createNovaProvider();
      const newDetector = new DistributorDetector(newFileManager, newProvider);

      try {
        // Step 3: Run detection again with same date (should not re-scan)
        const result2 = await newDetector.detectDistributors(endDate);

        // Should return same data without additional scanning
        expect(result2).toEqual(result1);

        // Step 4: Extend detection to new date - use a custom date for efficiency
        const customBlockNumbers = JSON.parse(JSON.stringify(testBlockNumbers));
        customBlockNumbers.blocks["2022-10-01"] = 100000; // Scan ~96k blocks from 3584
        newFileManager.writeBlockNumbers(customBlockNumbers as BlockNumberData);

        const newEndDate = new Date("2022-10-01");
        const result3 = await newDetector.detectDistributors(newEndDate);

        // Verify incremental scan worked
        expect(result3.metadata.last_scanned_block).toBe(100000);
        // Should still have same distributors (no new ones in this range)
        expect(Object.keys(result3.distributors).length).toBe(
          Object.keys(result1.distributors).length,
        );
      } finally {
        await newProvider.destroy();
      }
    });

    it("should handle existing distributor data without creating duplicates", async () => {
      // Setup: Create existing distributor data
      const existingData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: ARBOWNER_PRECOMPILE_ADDRESS,
          last_scanned_block: 100,
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash: "0x" + "a".repeat(64),
            method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0xOLDDATA",
            is_reward_distributor: false,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      testContext.fileManager.writeDistributors(existingData);
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Run detection that will encounter the same distributor
      const endDate = new Date("2022-08-09");
      const result = await distributorDetector.detectDistributors(endDate);

      // Verify distributor was not overwritten
      expect(
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"]
          ?.tx_hash,
      ).toBe("0x" + "a".repeat(64));
      expect(
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"]
          ?.event_data,
      ).toBe("0xOLDDATA");

      // Verify new distributors were added
      expect(Object.keys(result.distributors).length).toBeGreaterThanOrEqual(2);
    });

    it("should correctly identify reward distributors using bytecode verification", async () => {
      // For this test, we need to scan to the reward distributor at block 3163115
      // We'll start from a closer point to minimize scanning
      const existingData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: ARBOWNER_PRECOMPILE_ADDRESS,
          last_scanned_block: 3150000, // Start close to target
        },
        distributors: {},
      };

      testContext.fileManager.writeDistributors(existingData);
      const customBlockNumbers = JSON.parse(JSON.stringify(testBlockNumbers));
      customBlockNumbers.blocks["2023-02-15"] = 3165000; // Just past the events
      testContext.fileManager.writeBlockNumbers(
        customBlockNumbers as BlockNumberData,
      );

      // Run detection for a smaller range
      const endDate = new Date("2023-02-15");
      const result = await distributorDetector.detectDistributors(endDate);

      // Check specific distributor known to be a reward distributor
      expect(
        result.distributors["0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"],
      ).toBeDefined();

      const rewardDistributor =
        result.distributors["0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"];
      expect(rewardDistributor?.is_reward_distributor).toBe(true);
    });
  });

  describe("Error Scenarios", () => {
    it("should throw error when block numbers file is missing", async () => {
      // Don't write block numbers file
      const endDate = new Date("2023-03-16");

      await expect(
        distributorDetector.detectDistributors(endDate),
      ).rejects.toThrow("Block numbers data not found");
    });

    it("should throw error when end date not found in block numbers", async () => {
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Use date not in block numbers
      const endDate = new Date("2025-01-01");

      await expect(
        distributorDetector.detectDistributors(endDate),
      ).rejects.toThrow("Block number not found for date 2025-01-01");
    });
  });

  describe("Data Persistence Verification", () => {
    it("should maintain chain_id consistency across updates", async () => {
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // First run
      const endDate1 = new Date("2022-07-12");
      const result1 = await distributorDetector.detectDistributors(endDate1);
      expect(result1.metadata.chain_id).toBe(42170);

      // Second run with a small incremental scan
      const endDate2 = new Date("2022-08-09");
      const result2 = await distributorDetector.detectDistributors(endDate2);
      expect(result2.metadata.chain_id).toBe(42170);
    });

    it("should create proper directory structure for distributors", async () => {
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Use a small date range that still finds distributors
      const endDate = new Date("2022-07-12");
      await distributorDetector.detectDistributors(endDate);

      // Verify file structure
      const storePath = path.join(testContext.tempDir, "store");
      expect(fs.existsSync(path.join(storePath, "distributors.json"))).toBe(
        true,
      );

      // Read and verify content structure
      const content = fs.readFileSync(
        path.join(storePath, "distributors.json"),
        "utf8",
      );
      const data = JSON.parse(content);

      expect(data).toHaveProperty("metadata");
      expect(data).toHaveProperty("distributors");
      expect(data.metadata).toHaveProperty("chain_id");
      expect(data.metadata).toHaveProperty("arbowner_address");
      expect(data.metadata).toHaveProperty("last_scanned_block");
    });
  });
});
