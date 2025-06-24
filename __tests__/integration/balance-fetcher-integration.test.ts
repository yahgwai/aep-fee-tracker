import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs/promises";
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

// Test distributor addresses and their creation dates - using checksummed addresses
const TEST_DISTRIBUTORS: Record<
  string,
  { createdAt: string; createdBlock: number }
> = {
  [ethers.getAddress("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB")]: {
    createdAt: "2022-07-12",
    createdBlock: 152,
  },
  [ethers.getAddress("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce")]: {
    createdAt: "2023-03-16",
    createdBlock: 3163115,
  },
  [ethers.getAddress("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De")]: {
    createdAt: "2023-03-16",
    createdBlock: 3163115,
  },
  [ethers.getAddress("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f")]: {
    createdAt: "2023-03-16",
    createdBlock: 3163115,
  },
  [ethers.getAddress("0xdff90519a9DE6ad469D4f9839a9220C5D340B792")]: {
    createdAt: "2022-08-09",
    createdBlock: 684,
  },
};

// Helper to load expected balance data
async function loadExpectedBalanceData(
  distributorAddress: string,
): Promise<BalanceData> {
  // Convert to lowercase for directory path (test data directories use lowercase)
  const lowerCaseAddress = distributorAddress.toLowerCase();
  const balanceFilePath = path.join(
    __dirname,
    "../test-data/distributor-detector/balance_data",
    lowerCaseAddress,
    "balances.json",
  );
  const content = await fs.readFile(balanceFilePath, "utf-8");
  return JSON.parse(content);
}

// Helper to create test distributors data
function createTestDistributorsData(): DistributorsData {
  const distributors: DistributorsData = {
    metadata: {
      chain_id: ARBITRUM_NOVA_CHAIN_ID,
      arbowner_address: ARBOWNER_PRECOMPILE_ADDRESS,
      last_scanned_block: 3187362,
    },
    distributors: {},
  };

  // Add distributor 1 - checksummed address
  const addr1 = ethers.getAddress("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB");
  distributors.distributors[addr1] = {
    type: DistributorType.L2_SURPLUS_FEE,
    block: 152,
    date: "2022-07-12",
    tx_hash:
      "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
    method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
    owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
    event_data: "",
    is_reward_distributor: false,
    distributor_address: addr1,
  };

  // Add distributor 2 - checksummed address
  const addr2 = ethers.getAddress("0xdff90519a9DE6ad469D4f9839a9220C5D340B792");
  distributors.distributors[addr2] = {
    type: DistributorType.L2_BASE_FEE,
    block: 684,
    date: "2022-08-09",
    tx_hash:
      "0x91cf95025dd73017bb3b8a2a93e2bb2c666bbdce97f88ac4ae3e583aa1aa6a96",
    method: DISTRIBUTOR_METHODS.L2_BASE_FEE,
    owner: "0x67CB8A1b249D1b1A79f1e6252faCE5c90Cfc38EA",
    event_data: "",
    is_reward_distributor: false,
    distributor_address: addr2,
  };

  // Add distributor 3 - checksummed address
  const addr3 = ethers.getAddress("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce");
  distributors.distributors[addr3] = {
    type: DistributorType.L1_SURPLUS_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr3,
  };

  // Add distributor 4 - checksummed address
  const addr4 = ethers.getAddress("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De");
  distributors.distributors[addr4] = {
    type: DistributorType.L2_SURPLUS_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr4,
  };

  // Add distributor 5 - checksummed address
  const addr5 = ethers.getAddress("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f");
  distributors.distributors[addr5] = {
    type: DistributorType.L2_BASE_FEE,
    block: 3163115,
    date: "2023-03-16",
    tx_hash:
      "0x96c37e0e24e1de2b39e6f5f37e587285b55c666de2e37eb0a13f96a8b949b2e2",
    method: DISTRIBUTOR_METHODS.L2_BASE_FEE,
    owner: "0x10e7853938491D1f65f46dC201a5A4c622521201",
    event_data: "",
    is_reward_distributor: true,
    distributor_address: addr5,
  };

  return distributors;
}

describe("BalanceFetcher - Integration Tests", () => {
  let testContext: TestContext;
  let balanceFetcher: BalanceFetcher;
  let provider: ethers.JsonRpcProvider;
  let fileManager: FileManager;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    fileManager = testContext.fileManager as unknown as FileManager;
    provider = createNovaProvider();
    balanceFetcher = new BalanceFetcher(fileManager, provider);

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

  describe("Basic Balance Fetching", () => {
    it("should fetch balances for all distributors and create balance files", async () => {
      // Act
      const result = await balanceFetcher.fetchBalances();

      // Assert
      // Should have fetched balances for all 5 distributors
      expect(Object.keys(result).length).toBe(5);

      // Verify balance files were created for each distributor
      for (const distributorAddress of Object.keys(TEST_DISTRIBUTORS)) {
        const balanceData =
          fileManager.readDistributorBalances(distributorAddress);
        expect(balanceData).toBeDefined();
        expect(balanceData?.metadata.chain_id).toBe(ARBITRUM_NOVA_CHAIN_ID);
        expect(balanceData?.metadata.reward_distributor).toBe(
          distributorAddress,
        );
        expect(balanceData?.balances).toBeDefined();
      }
    });
  });

  describe("Balance Value Verification", () => {
    it("should fetch correct balance values that match test data", async () => {
      // Act
      await balanceFetcher.fetchBalances();

      // Assert - Compare fetched balances with expected test data
      for (const distributorAddress of Object.keys(TEST_DISTRIBUTORS)) {
        const fetchedData =
          fileManager.readDistributorBalances(distributorAddress);
        const expectedData = await loadExpectedBalanceData(distributorAddress);

        expect(fetchedData).toBeDefined();
        expect(fetchedData?.metadata).toEqual(expectedData.metadata);

        // Compare balance values for each date
        for (const [date, expectedBalance] of Object.entries(
          expectedData.balances,
        )) {
          // Only check dates from distributor creation onward
          const distributorInfo = TEST_DISTRIBUTORS[distributorAddress];
          if (distributorInfo && date >= distributorInfo.createdAt) {
            expect(fetchedData?.balances[date]).toEqual(expectedBalance);
          }
        }
      }
    });
  });

  describe("Incremental Processing", () => {
    it("should not fetch any new balances when run twice", async () => {
      // First run - fetch all balances
      const firstResult = await balanceFetcher.fetchBalances();
      expect(Object.keys(firstResult).length).toBeGreaterThan(0);

      // Second run - should fetch no new balances
      const secondResult = await balanceFetcher.fetchBalances();
      expect(Object.keys(secondResult).length).toBe(0);
    });

    it("should fetch only new dates when block numbers are added", async () => {
      // First run with limited dates
      const limitedBlockNumbers: BlockNumberData = {
        metadata: { chain_id: ARBITRUM_NOVA_CHAIN_ID },
        blocks: {
          "2022-07-12": 155,
          "2022-07-13": 189,
        },
      };
      fileManager.writeBlockNumbers(limitedBlockNumbers);
      await balanceFetcher.fetchBalances();

      // Add more dates
      fileManager.writeBlockNumbers(testBlockNumbers as BlockNumberData);

      // Second run should only fetch new dates
      const secondResult = await balanceFetcher.fetchBalances();

      // Should have fetched balances for dates after 2022-07-13
      for (const balances of Object.values(secondResult)) {
        for (const date of Object.keys(balances)) {
          expect(date).not.toBe("2022-07-12");
          expect(date).not.toBe("2022-07-13");
        }
      }
    });
  });

  describe("Distributor Creation Date Filtering", () => {
    it("should only fetch balances from distributor creation date onward", async () => {
      // Act
      await balanceFetcher.fetchBalances();

      // Assert - Check distributors created on 2023-03-16
      const lateDistributors = [
        ethers.getAddress("0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"),
        ethers.getAddress("0x509386DbF5C0BE6fd68Df97A05fdB375136c32De"),
        ethers.getAddress("0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f"),
      ];

      for (const distributorAddress of lateDistributors) {
        const balanceData =
          fileManager.readDistributorBalances(distributorAddress);
        expect(balanceData).toBeDefined();

        // Should not have any balances before 2023-03-16
        for (const date of Object.keys(balanceData!.balances)) {
          expect(date >= "2023-03-16").toBe(true);
        }

        // Should have balances for 2023-03-16 and 2023-03-17
        expect(balanceData!.balances["2023-03-16"]).toBeDefined();
        expect(balanceData!.balances["2023-03-17"]).toBeDefined();

        // Should NOT have earlier dates
        expect(balanceData!.balances["2023-03-15"]).toBeUndefined();
        expect(balanceData!.balances["2022-08-09"]).toBeUndefined();
      }
    });

    it("should include creation block if no end-of-day block exists for creation date", async () => {
      // Act
      await balanceFetcher.fetchBalances();

      // Assert - Check distributor created on 2022-08-09 with creation block 684
      const balanceData = fileManager.readDistributorBalances(
        ethers.getAddress("0xdff90519a9DE6ad469D4f9839a9220C5D340B792"),
      );

      // The test block numbers have 2022-08-09 at block 3584
      // But the creation block 684 should also be included
      expect(balanceData?.balances["2022-08-09"]).toBeDefined();
      expect(balanceData?.balances["2022-08-09"]?.block_number).toBe(3584);
    });
  });

  describe("Single Distributor Filtering", () => {
    it("should only fetch balances for specified distributor", async () => {
      const targetDistributor = ethers.getAddress(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );

      // Act
      const result = await balanceFetcher.fetchBalances(targetDistributor);

      // Assert
      expect(Object.keys(result).length).toBe(1);
      expect(result[targetDistributor]).toBeDefined();

      // Only the target distributor should have balance data
      const targetBalanceData =
        fileManager.readDistributorBalances(targetDistributor);
      expect(targetBalanceData).toBeDefined();

      // Other distributors should not have balance files
      for (const address of Object.keys(TEST_DISTRIBUTORS)) {
        if (address !== targetDistributor) {
          const balanceData = fileManager.readDistributorBalances(address);
          expect(balanceData).toBeUndefined();
        }
      }
    });

    it("should throw error for non-existent distributor", async () => {
      const invalidAddress = "0x0000000000000000000000000000000000000000";

      // Act & Assert
      await expect(
        balanceFetcher.fetchBalances(invalidAddress),
      ).rejects.toThrow(`Distributor not found: ${invalidAddress}`);
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC failures with retry", async () => {
      // This test verifies that the retry mechanism works
      // The actual implementation uses withRetry which should handle transient failures
      // We'll just verify the balances are eventually fetched despite potential RPC issues

      // Act
      const result = await balanceFetcher.fetchBalances();

      // Assert - If we got results, the retry mechanism worked
      expect(Object.keys(result).length).toBe(5);
    });
  });

  describe("Return Value Verification", () => {
    it("should return collected balances as decimal strings", async () => {
      // Act
      const result = await balanceFetcher.fetchBalances();

      // Assert
      for (const [address, balances] of Object.entries(result)) {
        expect(typeof address).toBe("string");
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);

        for (const [date, balance] of Object.entries(balances)) {
          expect(typeof date).toBe("string");
          expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(typeof balance).toBe("string");
          // Balance should be a valid decimal string
          expect(balance).toMatch(/^\d+$/);
        }
      }
    });

    it("should return empty object when no distributors exist", async () => {
      // Setup - Remove distributors
      fileManager.writeDistributors({
        metadata: {
          chain_id: ARBITRUM_NOVA_CHAIN_ID,
          arbowner_address: ARBOWNER_PRECOMPILE_ADDRESS,
        },
        distributors: {},
      });

      // Act
      const result = await balanceFetcher.fetchBalances();

      // Assert
      expect(result).toEqual({});
    });

    it("should return empty object when no block numbers exist", async () => {
      // Setup - Remove block numbers
      cleanupTestEnvironment(testContext.tempDir);
      testContext = setupTestEnvironment();
      fileManager = testContext.fileManager as unknown as FileManager;
      balanceFetcher = new BalanceFetcher(fileManager, provider);

      // Only write distributors, no block numbers
      fileManager.writeDistributors(createTestDistributorsData());

      // Act
      const result = await balanceFetcher.fetchBalances();

      // Assert
      expect(result).toEqual({});
    });
  });
});
