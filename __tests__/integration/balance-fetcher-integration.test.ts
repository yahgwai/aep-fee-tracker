import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { BalanceFetcher } from "../../src/balance-fetcher";
import { FileManager } from "../../src/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  BalanceData,
  DistributorType,
  DISTRIBUTOR_METHODS,
} from "../../src/types";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import testBlockNumbers from "../test-data/distributor-detector/block_numbers.json";
import testDistributorEvents from "../test-data/distributor-detector/distributor-creation-events-raw.json";

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

// Helper to convert event data to DistributorsData format
function createDistributorsData(
  events: typeof testDistributorEvents,
): DistributorsData {
  const distributorsData: DistributorsData = {
    metadata: {
      chain_id: ARBITRUM_NOVA_CHAIN_ID,
      arbowner_address: "0x0000000000000000000000000000000000000070",
      last_scanned_block: 3187362, // Last block in our test data
    },
    distributors: {},
  };

  // Map of method signatures to distributor types
  const methodToType: Record<string, DistributorType> = {
    "0x57f585db": DistributorType.L2_BASE_FEE,
    "0xfcdde2b4": DistributorType.L2_SURPLUS_FEE,
    "0x934be07d": DistributorType.L1_SURPLUS_FEE,
  };

  // Map of method signatures to DISTRIBUTOR_METHODS
  const methodToDistributorMethod: Record<string, string> = {
    "0x57f585db": DISTRIBUTOR_METHODS.L2_BASE_FEE,
    "0xfcdde2b4": DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
    "0x934be07d": DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
  };

  // Process events to extract distributor information
  for (const event of events.events) {
    if (!event.topics[1] || !event.topics[2]) continue;

    const methodSignature = event.topics[1].slice(0, 10);
    const rawOwner = "0x" + event.topics[2].slice(26);
    const owner = ethers.getAddress(rawOwner); // Checksum the address

    // Extract distributor address from event data
    // The data field has the format:
    // 0x + offset (64 chars) + length (64 chars) + method (8 chars) + padded address (64 chars)
    // The address is the last 40 characters of the padded address field
    const dataWithoutPrefix = event.data.slice(2); // Remove 0x
    // Skip offset (64) + length (64) + method (8) = 136 chars
    const paddedAddress = dataWithoutPrefix.slice(136, 200); // 64 chars for padded address
    // Take the last 40 chars (20 bytes) which is the actual address
    const rawAddress = "0x" + paddedAddress.slice(24);
    const distributorAddress = ethers.getAddress(rawAddress); // Checksum the address

    // Get block timestamp and convert to date
    const blockDate = new Date(event.blockTimestamp * 1000);
    const dateString = blockDate.toISOString().split("T")[0];

    // Check if this distributor is a reward distributor
    // Based on the test data, the three distributors created at block 3163115 are reward distributors
    const isRewardDistributor = event.blockNumber === 3163115;

    const distributorType = methodToType[methodSignature];
    const distributorMethod = methodToDistributorMethod[methodSignature];

    if (!distributorType || !distributorMethod) continue;

    distributorsData.distributors[distributorAddress] = {
      type: distributorType,
      block: event.blockNumber,
      date: dateString || "",
      tx_hash: event.transactionHash,
      method: distributorMethod,
      owner: owner,
      event_data: event.data,
      is_reward_distributor: isRewardDistributor,
      distributor_address: distributorAddress,
    };
  }

  return distributorsData;
}

// Helper to load expected balance data for a distributor
function loadExpectedBalanceData(
  distributorAddress: string,
): BalanceData | null {
  try {
    const balanceFilePath = path.join(
      __dirname,
      "../test-data/distributor-detector/balance_data",
      distributorAddress,
      "balances.json",
    );
    const content = fs.readFileSync(balanceFilePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

describe("BalanceFetcher - Integration Tests", () => {
  let testContext: TestContext;
  let balanceFetcher: BalanceFetcher;
  let provider: ethers.JsonRpcProvider;

  // Helper to check if RPC supports historical queries
  async function checkHistoricalRPCSupport(): Promise<boolean> {
    try {
      await provider.getBalance(
        "0x0000000000000000000000000000000000000000",
        155,
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("missing trie node") ||
        errorMessage.includes("not available")
      ) {
        console.log(
          "Skipping test: RPC does not support historical state queries for early blocks",
        );
        return false;
      }
      throw error;
    }
  }

  beforeEach(() => {
    testContext = setupTestEnvironment();
    provider = createNovaProvider();
    balanceFetcher = new BalanceFetcher(
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

  describe("Complete Balance Fetching Lifecycle (Requires Historical RPC)", () => {
    it("should fetch balances for all 5 distributors with real RPC calls", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }
      // Setup: Write block numbers and distributors data
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute: Fetch balances for all distributors
      const result = await balanceFetcher.fetchBalances();

      // Verify: Check that balances were fetched for all distributors
      expect(Object.keys(result).length).toBe(5);

      // Verify each distributor has balance data
      const expectedDistributors = [
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
        "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f",
      ];

      for (const distributorAddress of expectedDistributors) {
        expect(result).toHaveProperty(distributorAddress);

        // Verify files were created
        const balanceData =
          testContext.fileManager.readDistributorBalances(distributorAddress);
        expect(balanceData).toBeDefined();
        expect(balanceData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
        expect(balanceData?.metadata.reward_distributor).toBe(
          distributorAddress,
        );
      }
    });

    it("should respect distributor creation dates and not fetch balances before creation", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute: Fetch balances
      await balanceFetcher.fetchBalances();

      // Verify: Check that each distributor only has balances from creation date onward
      const distributorCreationDates: Record<string, string> = {
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": "2022-07-12",
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792": "2022-08-09",
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce": "2023-03-16",
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De": "2023-03-16",
        "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f": "2023-03-16",
      };

      for (const [distributorAddress, creationDate] of Object.entries(
        distributorCreationDates,
      )) {
        const balanceData =
          testContext.fileManager.readDistributorBalances(distributorAddress);
        expect(balanceData).toBeDefined();

        // Check that no balance exists before creation date
        for (const date of Object.keys(balanceData!.balances)) {
          expect(date >= creationDate).toBe(true);
        }

        // Check that the creation date is included
        expect(balanceData!.balances).toHaveProperty(creationDate);
      }
    });

    it("should correctly handle incremental processing and not refetch existing balances", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // First run: Fetch all balances
      const result1 = await balanceFetcher.fetchBalances();
      expect(Object.keys(result1).length).toBeGreaterThan(0);

      // Second run: Should fetch nothing as all balances exist
      const result2 = await balanceFetcher.fetchBalances();

      // Verify: No new balances should be fetched
      expect(Object.keys(result2).length).toBe(0);

      // Verify: Balance files still exist and contain same data
      for (const distributorAddress of Object.keys(
        distributorsData.distributors,
      )) {
        const balanceData =
          testContext.fileManager.readDistributorBalances(distributorAddress);
        expect(balanceData).toBeDefined();

        // Count should match first run
        const balanceCount = Object.keys(balanceData!.balances).length;
        expect(balanceCount).toBeGreaterThan(0);
      }
    });

    it("should fetch balances for a single distributor when distributorAddress is provided", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute: Fetch balances for a single distributor
      const targetDistributor = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";
      const result = await balanceFetcher.fetchBalances(targetDistributor);

      // Verify: Only the target distributor should have balances
      expect(Object.keys(result).length).toBe(1);
      expect(result).toHaveProperty(targetDistributor);

      // Verify: Balance file was created only for target distributor
      const balanceData =
        testContext.fileManager.readDistributorBalances(targetDistributor);
      expect(balanceData).toBeDefined();
      expect(balanceData?.metadata.reward_distributor).toBe(targetDistributor);

      // Verify: Other distributors don't have balance files
      const otherDistributors = Object.keys(
        distributorsData.distributors,
      ).filter((addr) => addr !== targetDistributor);

      for (const otherAddr of otherDistributors) {
        const otherBalanceData =
          testContext.fileManager.readDistributorBalances(otherAddr);
        expect(otherBalanceData).toBeUndefined();
      }
    });

    it("should verify fetched balance values match known test data", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute: Fetch balances
      await balanceFetcher.fetchBalances();

      // Verify: Compare fetched values with known test data
      const distributorsToVerify = [
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      ];

      for (const distributorAddress of distributorsToVerify) {
        const fetchedData =
          testContext.fileManager.readDistributorBalances(distributorAddress);
        const expectedData = loadExpectedBalanceData(distributorAddress);

        expect(fetchedData).toBeDefined();
        expect(expectedData).toBeDefined();

        // Get creation date for this distributor
        const distributorInfo =
          distributorsData.distributors[distributorAddress];
        if (!distributorInfo) continue;
        const creationDate = distributorInfo.date;

        // Compare balance values for dates from creation onward
        for (const [date, expectedBalance] of Object.entries(
          expectedData!.balances,
        )) {
          if (date >= creationDate) {
            const fetchedBalance = fetchedData!.balances[date];
            expect(fetchedBalance).toBeDefined();
            expect(fetchedBalance?.balance_wei).toBe(
              expectedBalance.balance_wei,
            );
            expect(fetchedBalance?.block_number).toBe(
              expectedBalance.block_number,
            );
          }
        }
      }
    });

    it("should handle distributor creation blocks that coincide with end-of-day blocks", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // The distributor at 0xdff90519a9DE6ad469D4f9839a9220C5D340B792 was created
      // on 2022-08-09 at block 684, but the end-of-day block for that date is 3584
      const targetDistributor = "0xdff90519a9DE6ad469D4f9839a9220C5D340B792";

      // Execute: Fetch balances
      await balanceFetcher.fetchBalances(targetDistributor);

      // Verify: Should have balance for creation date at end-of-day block
      const balanceData =
        testContext.fileManager.readDistributorBalances(targetDistributor);
      expect(balanceData).toBeDefined();
      expect(balanceData!.balances["2022-08-09"]).toBeDefined();
      const balanceEntry = balanceData!.balances["2022-08-09"];
      expect(balanceEntry?.block_number).toBe(3584); // End-of-day block, not creation block
    });
  });

  describe("Error Handling", () => {
    it("should throw error when trying to fetch balances for non-existent distributor", async () => {
      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute & Verify
      const nonExistentAddress = "0x0000000000000000000000000000000000000000";

      // This test doesn't need to make RPC calls - it should fail before that
      await expect(
        balanceFetcher.fetchBalances(nonExistentAddress),
      ).rejects.toThrow(`Distributor not found: ${nonExistentAddress}`);
    });

    it("should handle empty distributors data gracefully", async () => {
      // Setup: Write block numbers but no distributors
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Execute: Should return empty result
      const result = await balanceFetcher.fetchBalances();

      // Verify
      expect(result).toEqual({});
    });

    it("should handle missing block numbers gracefully", async () => {
      // Setup: Write distributors but no block numbers
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute: Should return empty result
      const result = await balanceFetcher.fetchBalances();

      // Verify
      expect(result).toEqual({});
    });
  });

  describe("Data Persistence and File Structure", () => {
    it("should create proper directory structure for balance data", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Execute
      const targetDistributor = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";
      await balanceFetcher.fetchBalances(targetDistributor);

      // Verify: Check file structure
      const distributorDir = path.join(
        testContext.tempDir,
        "store",
        "distributors",
        targetDistributor,
      );
      expect(fs.existsSync(distributorDir)).toBe(true);

      const balanceFile = path.join(distributorDir, "balances.json");
      expect(fs.existsSync(balanceFile)).toBe(true);

      // Verify: Check file content structure
      const content = fs.readFileSync(balanceFile, "utf8");
      const data = JSON.parse(content);

      expect(data).toHaveProperty("metadata");
      expect(data).toHaveProperty("balances");
      expect(data.metadata).toHaveProperty("chain_id");
      expect(data.metadata).toHaveProperty("reward_distributor");
      expect(data.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
      expect(data.metadata.reward_distributor).toBe(targetDistributor);
    });

    it("should preserve existing balance data when adding new balances", async () => {
      // Check if RPC supports historical queries
      if (!(await checkHistoricalRPCSupport())) {
        return;
      }

      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);

      // Create distributors data with only one distributor first
      const distributorInfo =
        distributorsData.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ];
      if (!distributorInfo) {
        throw new Error("Test data missing expected distributor");
      }
      const singleDistributorData: DistributorsData = {
        ...distributorsData,
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": distributorInfo,
        },
      };
      testContext.fileManager.writeDistributors(singleDistributorData);

      // First run: Fetch initial balances
      await balanceFetcher.fetchBalances();

      // Verify initial data
      const initialData = testContext.fileManager.readDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(initialData).toBeDefined();
      const initialBalanceCount = Object.keys(initialData!.balances).length;

      // Modify block numbers to add a new date
      const extendedBlockNumbers = {
        ...testBlockNumbers,
        blocks: {
          ...testBlockNumbers.blocks,
          "2023-03-18": 3200000, // New date
        },
      };
      testContext.fileManager.writeBlockNumbers(
        extendedBlockNumbers as BlockNumberData,
      );

      // Second run: Fetch with new date
      await balanceFetcher.fetchBalances();

      // Verify: Old balances preserved and new balance added
      const updatedData = testContext.fileManager.readDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(updatedData).toBeDefined();
      expect(Object.keys(updatedData!.balances).length).toBe(
        initialBalanceCount + 1,
      );
      expect(updatedData!.balances).toHaveProperty("2023-03-18");

      // Verify all initial balances are still present
      for (const date of Object.keys(initialData!.balances)) {
        expect(updatedData!.balances[date]).toEqual(
          initialData!.balances[date],
        );
      }
    });
  });

  describe("Balance Fetching Logic Tests (Works with current blocks)", () => {
    it("should correctly parse distributor data and setup file structure", () => {
      // Setup: Write block numbers and distributors data
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Verify distributor data was parsed correctly
      expect(Object.keys(distributorsData.distributors).length).toBe(5);

      // Check specific distributors
      const distributor1 =
        distributorsData.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ];
      expect(distributor1).toBeDefined();
      expect(distributor1?.date).toBe("2022-07-12");
      expect(distributor1?.block).toBe(153); // Block 153 because same address was set twice

      const distributor2 =
        distributorsData.distributors[
          "0xdff90519a9DE6ad469D4f9839a9220C5D340B792"
        ];
      expect(distributor2).toBeDefined();
      expect(distributor2?.date).toBe("2022-08-09");
      expect(distributor2?.block).toBe(684);
    });

    it("should handle distributorAddress parameter correctly", async () => {
      // Setup
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );
      const distributorsData = createDistributorsData(testDistributorEvents);
      testContext.fileManager.writeDistributors(distributorsData);

      // Test error case - non-existent distributor
      const nonExistentAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        balanceFetcher.fetchBalances(nonExistentAddress),
      ).rejects.toThrow(`Distributor not found: ${nonExistentAddress}`);
    });

    it("should return empty result when no distributors data exists", async () => {
      // Setup: Only write block numbers
      testContext.fileManager.writeBlockNumbers(
        testBlockNumbers as BlockNumberData,
      );

      // Execute
      const result = await balanceFetcher.fetchBalances();

      // Verify
      expect(result).toEqual({});
    });

    it("should create proper balance data structure when writing balances", async () => {
      // This test verifies the file structure without making RPC calls
      // by directly testing the FileManager integration

      // Setup
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";
      const balanceData: BalanceData = {
        metadata: {
          chain_id: ARBITRUM_NOVA_CHAIN_ID,
          reward_distributor: distributorAddress,
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "1000000000000000000", // 1 ETH
          },
        },
      };

      // Write balance data
      testContext.fileManager.writeDistributorBalances(
        distributorAddress,
        balanceData,
      );

      // Verify file was created with correct structure
      const readData =
        testContext.fileManager.readDistributorBalances(distributorAddress);
      expect(readData).toEqual(balanceData);

      // Verify physical file exists
      const filePath = path.join(
        testContext.tempDir,
        "store",
        "distributors",
        distributorAddress,
        "balances.json",
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should verify correct extraction of distributor addresses from events", () => {
      const distributorsData = createDistributorsData(testDistributorEvents);

      // Verify all 5 distributors were extracted
      const addresses = Object.keys(distributorsData.distributors);
      expect(addresses.length).toBe(5);

      // Verify addresses are checksummed
      for (const address of addresses) {
        expect(address).toBe(ethers.getAddress(address.toLowerCase()));
      }

      // Verify specific known addresses
      expect(addresses).toContain("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB");
      expect(addresses).toContain("0xdff90519a9DE6ad469D4f9839a9220C5D340B792");
      expect(addresses).toContain("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce");
      expect(addresses).toContain("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De");
      expect(addresses).toContain("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f");
    });
  });
});
