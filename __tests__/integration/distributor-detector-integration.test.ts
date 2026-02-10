import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { DistributorDetector } from "../../src/core/distributor-detection/distributor-detector";
import { FileManager } from "../../src/infrastructure/storage/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  DistributorType,
} from "../../src/types";
import { DISTRIBUTOR_METHODS } from "../../src/constants";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import testBlockNumbers from "../test-data/distributor-detector/block_numbers.json";
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

/**
 * Filters testBlockNumbers to only include dates up to (and including) the given date.
 * Used to control the scan range since detectDistributors scans to the max block in the store.
 */
function blockNumbersUpTo(maxDate: string): BlockNumberData {
  const filtered: Record<string, number> = {};
  for (const [date, block] of Object.entries(
    (testBlockNumbers as BlockNumberData).blocks,
  )) {
    if (date <= maxDate) {
      filtered[date] = block;
    }
  }
  return {
    metadata: (testBlockNumbers as BlockNumberData).metadata,
    blocks: filtered,
  };
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
      // Step 1: Write block numbers up to July 13, 2022 (after first 2 distributors)
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-07-13"));

      // Step 2: Run detection
      const result1 = await distributorDetector.detectDistributors();

      // Verify initial detection results
      expect(result1.metadata.chain_id).toBe(42170);
      expect(result1.metadata.arbowner_address).toBe(
        ARBOWNER_PRECOMPILE_ADDRESS,
      );
      expect(result1.metadata.last_scanned_block).toBe(189);

      // Same address (0x37da...) was set for both L2_SURPLUS_FEE and L1_SURPLUS_FEE
      // With array structure, both types are now stored
      expect(Object.keys(result1.distributors).length).toBe(1);

      // Verify both distributor types are stored in the array
      const distributorArray =
        result1.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorArray).toHaveLength(2);

      // First should be L2_SURPLUS_FEE at block 152
      expect(distributorArray?.[0]).toMatchObject({
        type: DistributorType.L2_SURPLUS_FEE,
        block: 152,
        date: "2022-07-12",
        method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        is_reward_distributor: false,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });

      // Second should be L1_SURPLUS_FEE at block 153
      expect(distributorArray?.[1]).toMatchObject({
        type: DistributorType.L1_SURPLUS_FEE,
        block: 153,
        date: "2022-07-12",
        method: DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
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
      // Step 1: Write blocks up to July 12, 2022 and scan (finds first distributor at block 152)
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-07-12"));
      const result1 = await distributorDetector.detectDistributors();

      expect(result1.metadata.last_scanned_block).toBe(155);
      expect(Object.keys(result1.distributors).length).toBe(1);

      // Step 2: Extend blocks to Aug 9, 2022 and scan (finds L2_BASE_FEE at block 684)
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-08-09"));
      const result2 = await distributorDetector.detectDistributors();

      expect(result2.metadata.last_scanned_block).toBe(3584);
      expect(Object.keys(result2.distributors).length).toBe(2);

      // Step 3: Extend with a custom date far enough to test chunking but not too far
      const extendedBlocks = blockNumbersUpTo("2022-08-09");
      extendedBlocks.blocks["2022-09-15"] = 53584; // 50,000 blocks past previous scan
      testContext.fileManager.writeBlockNumbers(extendedBlocks);

      const result3 = await distributorDetector.detectDistributors();

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
      // Setup: Write block numbers up to Aug 9, 2022
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-08-09"));

      // Step 1: Initial detection
      const result1 = await distributorDetector.detectDistributors();
      expect(Object.keys(result1.distributors).length).toBe(2);

      // Step 2: Simulate process restart with new instances
      const storePath = path.join(testContext.tempDir, "store");
      const newFileManager = new FileManager(storePath);
      const newProvider = createNovaProvider();
      const newDetector = new DistributorDetector(newFileManager, newProvider);

      try {
        // Step 3: Run detection again with same block data (should not re-scan)
        const result2 = await newDetector.detectDistributors();

        // Should return same data without additional scanning
        expect(result2).toEqual(result1);

        // Step 4: Extend block data to test incremental scan
        const extendedBlocks = blockNumbersUpTo("2022-08-09");
        extendedBlocks.blocks["2022-10-01"] = 100000; // Scan ~96k blocks from 3584
        newFileManager.writeBlockNumbers(extendedBlocks);

        const result3 = await newDetector.detectDistributors();

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
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": [
            {
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
          ],
        },
      };

      testContext.fileManager.writeDistributors(existingData);
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-08-09"));

      // Run detection that will encounter the same distributor
      const result = await distributorDetector.detectDistributors();

      // Verify distributor was not overwritten
      expect(
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"]?.[0]
          ?.tx_hash,
      ).toBe("0x" + "a".repeat(64));
      expect(
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"]?.[0]
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
      testContext.fileManager.writeBlockNumbers({
        metadata: { chain_id: 42170 },
        blocks: { "2023-02-15": 3165000 },
      });

      // Run detection for a smaller range
      const result = await distributorDetector.detectDistributors();

      // Check specific distributor known to be a reward distributor
      expect(
        result.distributors["0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"],
      ).toBeDefined();

      const rewardDistributorArray =
        result.distributors["0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"];
      expect(rewardDistributorArray?.[0]?.is_reward_distributor).toBe(true);
    });
  });

  describe("Error Scenarios", () => {
    it("should throw error when block numbers file is missing", async () => {
      // Don't write block numbers file
      await expect(distributorDetector.detectDistributors()).rejects.toThrow(
        "Block numbers data not found",
      );
    });

    it("should throw error when block numbers data is empty", async () => {
      testContext.fileManager.writeBlockNumbers({
        metadata: { chain_id: 42170 },
        blocks: {},
      });

      await expect(distributorDetector.detectDistributors()).rejects.toThrow(
        "Block numbers data is empty",
      );
    });
  });

  describe("Data Persistence Verification", () => {
    it("should maintain chain_id consistency across updates", async () => {
      // First run with blocks up to July 12
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-07-12"));
      const result1 = await distributorDetector.detectDistributors();
      expect(result1.metadata.chain_id).toBe(42170);

      // Second run with blocks extended to Aug 9
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-08-09"));
      const result2 = await distributorDetector.detectDistributors();
      expect(result2.metadata.chain_id).toBe(42170);
    });

    it("should create proper directory structure for distributors", async () => {
      // Write blocks up to a small date that still finds distributors
      testContext.fileManager.writeBlockNumbers(blockNumbersUpTo("2022-07-12"));
      await distributorDetector.detectDistributors();

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
