import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ethers } from "ethers";
import { DistributorDetector } from "../../src/distributor-detector";
import { FileManager } from "../../src/file-manager";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import testData from "../test-data/distributor-detector/distributor-creation-events-raw.json";
import blockNumbersData from "../test-data/distributor-detector/block_numbers.json";
import rewardDistributorBytecodeData from "../test-data/distributor-detector/reward-distributor-bytecode.json";
import { DistributorType, DistributorInfo } from "../../src/types";

// Test RPC provider that serves pre-recorded test data
class TestRpcProvider extends ethers.JsonRpcProvider {
  private testEvents: typeof testData.events;
  private rewardDistributorBytecode: string;

  constructor() {
    // Use a dummy URL since we'll override all methods
    super("http://localhost:8545", { chainId: 42170, name: "arbitrum-nova" });
    this.testEvents = testData.events;
    this.rewardDistributorBytecode = rewardDistributorBytecodeData.bytecode;
  }

  override async getNetwork(): Promise<ethers.Network> {
    return ethers.Network.from({ chainId: 42170, name: "arbitrum-nova" });
  }

  override async getBlock(
    blockTag: ethers.BlockTag,
  ): Promise<ethers.Block | null> {
    const blockNumber =
      typeof blockTag === "number" ? blockTag : parseInt(blockTag.toString());
    const event = this.testEvents.find((e) => e.blockNumber === blockNumber);
    if (event) {
      return {
        number: blockNumber,
        timestamp: event.blockTimestamp,
        hash: "0x" + "0".repeat(64),
      } as ethers.Block;
    }
    // For other blocks, return a dummy block
    return {
      number: blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      hash: "0x" + "0".repeat(64),
    } as ethers.Block;
  }

  override async getLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
    const fromBlock = filter.fromBlock as number;
    const toBlock = filter.toBlock as number;

    // Filter events by block range and topics if provided
    const filteredEvents = this.testEvents.filter((event) => {
      if (event.blockNumber < fromBlock || event.blockNumber > toBlock) {
        return false;
      }

      // Check if topics match (if filter has topic requirements)
      if (filter.topics && Array.isArray(filter.topics)) {
        const filterTopics = filter.topics;
        // Check first topic (event signature)
        if (filterTopics[0] && event.topics[0] !== filterTopics[0]) {
          return false;
        }
        // Check second topic (method signatures - OR filter)
        if (
          filterTopics[1] &&
          Array.isArray(filterTopics[1]) &&
          event.topics[1]
        ) {
          // The filter expects unpadded method signatures, but the event has padded ones
          // Extract the first 10 characters (0x + 8 hex chars) from the event topic
          const eventMethodSig = event.topics[1].substring(0, 10);
          if (!filterTopics[1].includes(eventMethodSig)) {
            return false;
          }
        }
      }

      return true;
    });

    // Convert to ethers.Log format
    return filteredEvents.map(
      (event) =>
        ({
          blockNumber: event.blockNumber,
          blockHash: "0x" + "0".repeat(64),
          transactionIndex: event.transactionIndex,
          removed: false,
          address: event.address,
          data: event.data,
          topics: event.topics as readonly string[],
          transactionHash: event.transactionHash,
          index: event.logIndex,
        }) as ethers.Log,
    );
  }

  override async getCode(address: string): Promise<string> {
    // For the test, we'll return the reward distributor bytecode for specific addresses
    const checksumAddress = ethers.getAddress(address);

    // These are the distributor addresses from our test data
    const rewardDistributors = [
      "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
    ];

    if (rewardDistributors.includes(checksumAddress)) {
      return this.rewardDistributorBytecode;
    }

    // Return different bytecode for non-reward distributors
    return "0x1234";
  }
}

describe("DistributorDetector Integration Tests", () => {
  let testContext: TestContext;
  let fileManager: FileManager;
  let provider: TestRpcProvider;
  let detector: DistributorDetector;

  beforeEach(() => {
    // Set up test environment with temporary directory
    testContext = setupTestEnvironment();

    // Create concrete FileManager instance
    fileManager = new FileManager("store");

    // Create test RPC provider
    provider = new TestRpcProvider();

    // Create detector instance with real FileManager and test provider
    detector = new DistributorDetector(fileManager, provider);
  });

  afterEach(() => {
    // Clean up test environment
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("detectDistributors with FileManager persistence", () => {
    it("should discover distributors and persist them via FileManager", async () => {
      // Arrange
      // Write block numbers data that includes 2022-07-12
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act
      const result = await detector.detectDistributors(new Date("2022-07-12"));

      // Assert
      // Check that distributor was discovered (first two events have same address)
      expect(result.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(Object.keys(result.distributors)).toHaveLength(1);

      // Verify the distributor info
      const distributor =
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributor).toBeDefined();
      expect(distributor!.type).toBe(DistributorType.L2_SURPLUS_FEE);
      expect(distributor!.block).toBe(152);
      expect(distributor!.date).toBe("2022-07-12");
      expect(distributor!.tx_hash).toBe(
        "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
      );
      expect(distributor!.is_reward_distributor).toBe(true);

      // Check metadata
      expect(result.metadata).toEqual({
        chain_id: 42170,
        arbowner_address: "0x0000000000000000000000000000000000000070",
        last_scanned_block: 155, // End of 2022-07-12
      });

      // Verify persistence by reading from FileManager
      const savedData = fileManager.readDistributors();
      expect(savedData).toEqual(result);
    });

    it("should handle incremental scanning correctly across multiple calls", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act - First scan up to 2022-07-12
      const firstResult = await detector.detectDistributors(
        new Date("2022-07-12"),
      );
      expect(Object.keys(firstResult.distributors)).toHaveLength(1);
      expect(firstResult.metadata.last_scanned_block).toBe(155);

      // Second scan up to 2022-08-09 (should find one more distributor at block 684)
      const secondResult = await detector.detectDistributors(
        new Date("2022-08-09"),
      );
      expect(Object.keys(secondResult.distributors)).toHaveLength(2);
      expect(secondResult.metadata.last_scanned_block).toBe(3584);

      // Verify the new distributor was added
      expect(secondResult.distributors).toHaveProperty(
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
      );

      // Verify the first distributor is still there
      expect(secondResult.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );

      // Third scan up to 2023-03-16 (should find three more distributors)
      const thirdResult = await detector.detectDistributors(
        new Date("2023-03-16"),
      );
      expect(Object.keys(thirdResult.distributors)).toHaveLength(5);
      expect(thirdResult.metadata.last_scanned_block).toBe(3166694);

      // Verify all distributors are present
      const expectedAddresses = [
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
        "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f",
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      ];
      expectedAddresses.forEach((address) => {
        expect(thirdResult.distributors).toHaveProperty(address);
      });

      // Verify persistence
      const savedData = fileManager.readDistributors();
      expect(savedData).toEqual(thirdResult);
    });

    it("should correctly handle state persistence and recovery", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act - Initial scan
      const initialResult = await detector.detectDistributors(
        new Date("2022-08-09"),
      );
      expect(Object.keys(initialResult.distributors)).toHaveLength(2);

      // Create a new detector instance (simulating restart)
      const newDetector = new DistributorDetector(fileManager, provider);

      // Scan again with the same date - should not make unnecessary RPC calls
      const sameResult = await newDetector.detectDistributors(
        new Date("2022-08-09"),
      );
      expect(sameResult).toEqual(initialResult);

      // Scan with a later date - should only scan new blocks
      const laterResult = await newDetector.detectDistributors(
        new Date("2023-03-16"),
      );
      expect(Object.keys(laterResult.distributors)).toHaveLength(5);

      // Verify all previous distributors are still present
      Object.keys(initialResult.distributors).forEach((address) => {
        expect(laterResult.distributors).toHaveProperty(address);
        expect(laterResult.distributors[address]).toEqual(
          initialResult.distributors[address],
        );
      });
    });

    it("should not overwrite existing distributor data", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // First scan to get initial distributors
      const firstResult = await detector.detectDistributors(
        new Date("2022-07-12"),
      );
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";
      const originalDistributor = firstResult.distributors[distributorAddress];
      expect(originalDistributor).toBeDefined();

      // Manually modify the saved data to simulate existing custom data
      const modifiedData = fileManager.readDistributors()!;
      modifiedData.distributors[distributorAddress] = {
        ...originalDistributor!,
        custom_field: "This should be preserved",
      } as unknown as DistributorInfo;
      fileManager.writeDistributors(modifiedData);

      // Act - Scan again with a later date
      const secondResult = await detector.detectDistributors(
        new Date("2022-08-09"),
      );

      // Assert - Original distributor data should be preserved
      expect(secondResult.distributors[distributorAddress]).toHaveProperty(
        "custom_field",
        "This should be preserved",
      );
    });

    it("should handle case when no new distributors are found", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Initial scan
      await detector.detectDistributors(new Date("2023-03-16"));

      // Act - Scan again with same date
      const result = await detector.detectDistributors(new Date("2023-03-16"));

      // Assert
      expect(Object.keys(result.distributors)).toHaveLength(5);
      expect(result.metadata.last_scanned_block).toBe(3166694);
    });

    it("should throw error when block numbers data is missing", async () => {
      // Act & Assert
      await expect(
        detector.detectDistributors(new Date("2022-07-12")),
      ).rejects.toThrow("Block numbers data not found");
    });

    it("should throw error when date is not in block numbers", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act & Assert
      await expect(
        detector.detectDistributors(new Date("2024-01-01")),
      ).rejects.toThrow("Block number not found for date 2024-01-01");
    });

    it("should correctly identify different distributor types", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act - Scan to get all distributors
      const result = await detector.detectDistributors(new Date("2023-03-16"));

      // Assert - Check distributor types
      const distributorsByType: Record<DistributorType, string[]> = {
        [DistributorType.L2_BASE_FEE]: [],
        [DistributorType.L2_SURPLUS_FEE]: [],
        [DistributorType.L1_SURPLUS_FEE]: [],
        [DistributorType.L1_BASE_FEE]: [],
      };

      Object.entries(result.distributors).forEach(([address, info]) => {
        distributorsByType[info.type].push(address);
      });

      // Based on test data, we should have:
      // Note: Distributor 0x37daA99... appears in both blocks 152 and 153, but only the first occurrence counts
      expect(distributorsByType[DistributorType.L2_SURPLUS_FEE]).toHaveLength(
        2,
      );
      expect(distributorsByType[DistributorType.L1_SURPLUS_FEE]).toHaveLength(
        1,
      );
      expect(distributorsByType[DistributorType.L2_BASE_FEE]).toHaveLength(2);
    });

    it("should correctly verify reward distributor bytecode", async () => {
      // Arrange
      fileManager.writeBlockNumbers(blockNumbersData);

      // Act
      const result = await detector.detectDistributors(new Date("2023-03-16"));

      // Assert - Check is_reward_distributor flags
      // Based on our test provider setup:
      expect(
        result.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"]
          ?.is_reward_distributor,
      ).toBe(true);
      expect(
        result.distributors["0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"]
          ?.is_reward_distributor,
      ).toBe(true);
      expect(
        result.distributors["0xdff90519a9DE6ad469D4f9839a9220C5D340B792"]
          ?.is_reward_distributor,
      ).toBe(false);
      expect(
        result.distributors["0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f"]
          ?.is_reward_distributor,
      ).toBe(false);
      expect(
        result.distributors["0x509386DbF5C0BE6fd68Df97A05fdB375136c32De"]
          ?.is_reward_distributor,
      ).toBe(false);
    });
  });
});
