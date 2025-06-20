import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { getAddress } from "ethers";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import { DistributorType, CONTRACTS } from "../../src/types";

describe("FileManager - Integration Tests", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("Critical Path: Complete Data Lifecycle", () => {
    it("should handle complete distributor lifecycle from discovery to reporting", () => {
      const { fileManager } = testContext;

      // Step 1: Write block numbers for date range
      console.log("Step 1: Writing block numbers for date range...");
      const blockNumbers = {
        metadata: {
          chain_id: 42170,
        },
        blocks: {
          "2024-01-09": 237089670,
          "2024-01-10": 237518127,
          "2024-01-11": 237946584,
          "2024-01-12": 238375041,
          "2024-01-13": 238803498,
        },
      };
      fileManager.writeBlockNumbers(blockNumbers);

      // Verify block numbers were written
      const savedBlockNumbers = fileManager.readBlockNumbers();
      expect(savedBlockNumbers).toEqual(blockNumbers);

      // Step 2: Discover and write new distributors
      console.log("Step 2: Writing distributor data...");
      const distributor1Address = getAddress(
        "0x1111111111111111111111111111111111111111",
      );
      const distributor2Address = getAddress(
        "0x4444444444444444444444444444444444444444",
      );

      const distributors = {
        metadata: {
          chain_id: 42170,
          arbowner_address: CONTRACTS.ARB_OWNER,
          last_scanned_block: 238803498,
        },
        distributors: {
          [distributor1Address]: {
            type: DistributorType.L2_BASE_FEE,
            block: 237300000,
            date: "2024-01-10",
            tx_hash: "0x" + "a".repeat(64),
            method: "factory",
            owner: getAddress("0x2222222222222222222222222222222222222222"),
            event_data: JSON.stringify({
              factory: "0x3333333333333333333333333333333333333333",
              event: "DistributorCreated",
            }),
            is_reward_distributor: false,
            distributor_address: distributor1Address,
          },
          [distributor2Address]: {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 238100000,
            date: "2024-01-11",
            tx_hash: "0x" + "b".repeat(64),
            method: "factory",
            owner: getAddress("0x5555555555555555555555555555555555555555"),
            event_data: JSON.stringify({
              factory: "0x6666666666666666666666666666666666666666",
              event: "DistributorCreated",
            }),
            is_reward_distributor: true,
            distributor_address: distributor2Address,
          },
        },
      };
      fileManager.writeDistributors(distributors);

      // Verify distributors were written
      const savedDistributors = fileManager.readDistributors();
      expect(savedDistributors).toEqual(distributors);

      // Step 3: Write daily balances for each distributor
      console.log("Step 3: Writing distributor balances...");

      const balances1 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributor1Address,
        },
        balances: {
          "2024-01-10": {
            block_number: 237518127,
            balance_wei: "0",
          },
          "2024-01-11": {
            block_number: 237946584,
            balance_wei: "1000000000000000000",
          },
          "2024-01-12": {
            block_number: 238375041,
            balance_wei: "2500000000000000000",
          },
        },
      };
      fileManager.writeDistributorBalances(distributor1Address, balances1);

      const balances2 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributor2Address,
        },
        balances: {
          "2024-01-11": {
            block_number: 237946584,
            balance_wei: "0",
          },
          "2024-01-12": {
            block_number: 238375041,
            balance_wei: "500000000000000000",
          },
          "2024-01-13": {
            block_number: 238803498,
            balance_wei: "750000000000000000",
          },
        },
      };
      fileManager.writeDistributorBalances(distributor2Address, balances2);

      // Step 4: Write daily outflows
      console.log("Step 4: Writing distributor outflows...");
      const outflows1 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributor1Address,
        },
        outflows: {
          "2024-01-11": {
            block_number: 237946584,
            total_outflow_wei: "0",
            events: [],
          },
          "2024-01-12": {
            block_number: 238375041,
            total_outflow_wei: "100000000000000000",
            events: [
              {
                recipient: getAddress(
                  "0x1000000000000000000000000000000000000001",
                ),
                value_wei: "100000000000000000",
                tx_hash: "0x" + "c".repeat(64),
              },
            ],
          },
        },
      };
      fileManager.writeDistributorOutflows(distributor1Address, outflows1);

      const outflows2 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributor2Address,
        },
        outflows: {
          "2024-01-12": {
            block_number: 238375041,
            total_outflow_wei: "0",
            events: [],
          },
          "2024-01-13": {
            block_number: 238803498,
            total_outflow_wei: "250000000000000000",
            events: [
              {
                recipient: getAddress(
                  "0x2000000000000000000000000000000000000002",
                ),
                value_wei: "150000000000000000",
                tx_hash: "0x" + "d".repeat(64),
              },
              {
                recipient: getAddress(
                  "0x3000000000000000000000000000000000000003",
                ),
                value_wei: "100000000000000000",
                tx_hash: "0x" + "e".repeat(64),
              },
            ],
          },
        },
      };
      fileManager.writeDistributorOutflows(distributor2Address, outflows2);

      // Step 5: Read everything back and verify consistency
      console.log("Step 5: Reading all data back and verifying consistency...");

      // Verify all files exist
      const storePath = path.join(testContext.tempDir, "store");
      expect(fs.existsSync(path.join(storePath, "block_numbers.json"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(storePath, "distributors.json"))).toBe(
        true,
      );
      expect(
        fs.existsSync(
          path.join(
            storePath,
            "distributors",
            distributor1Address,
            "balances.json",
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            storePath,
            "distributors",
            distributor1Address,
            "outflows.json",
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            storePath,
            "distributors",
            distributor2Address,
            "balances.json",
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            storePath,
            "distributors",
            distributor2Address,
            "outflows.json",
          ),
        ),
      ).toBe(true);

      // Read and verify data
      const readBalances1 =
        fileManager.readDistributorBalances(distributor1Address);
      const readBalances2 =
        fileManager.readDistributorBalances(distributor2Address);
      const readOutflows1 =
        fileManager.readDistributorOutflows(distributor1Address);
      const readOutflows2 =
        fileManager.readDistributorOutflows(distributor2Address);

      expect(readBalances1).toEqual(balances1);
      expect(readBalances2).toEqual(balances2);
      expect(readOutflows1).toEqual(outflows1);
      expect(readOutflows2).toEqual(outflows2);

      // Step 6: Simulate multi-day updates
      console.log("Step 6: Simulating multi-day updates...");

      // Add a new day's data
      const updatedBlockNumbers = {
        ...blockNumbers,
        blocks: {
          ...blockNumbers.blocks,
          "2024-01-14": 239231955,
        },
      };
      fileManager.writeBlockNumbers(updatedBlockNumbers);

      // Update balances with new day
      const updatedBalances1 = {
        ...balances1,
        balances: {
          ...balances1.balances,
          "2024-01-13": {
            block_number: 238803498,
            balance_wei: "3000000000000000000",
          },
        },
      };
      fileManager.writeDistributorBalances(
        distributor1Address,
        updatedBalances1,
      );

      // Verify updates persisted
      const finalBlockNumbers = fileManager.readBlockNumbers();
      const finalBalances1 =
        fileManager.readDistributorBalances(distributor1Address);

      expect(finalBlockNumbers!.blocks["2024-01-14"]).toBe(239231955);
      expect(finalBalances1!.balances["2024-01-13"]).toEqual({
        block_number: 238803498,
        balance_wei: "3000000000000000000",
      });

      // Verify we can find distributors in the expected range
      const startBlock = savedBlockNumbers!.blocks["2024-01-09"]!;
      const endBlock = savedBlockNumbers!.blocks["2024-01-13"]!;

      const distributorsInRange = Object.entries(
        savedDistributors!.distributors,
      ).filter(
        ([, info]) => info.block >= startBlock && info.block <= endBlock,
      );

      expect(distributorsInRange).toHaveLength(2);
      expect(distributorsInRange.map(([addr]) => addr)).toContain(
        distributor1Address,
      );
      expect(distributorsInRange.map(([addr]) => addr)).toContain(
        distributor2Address,
      );
    });
  });

  describe("Concurrent Operations Safety", () => {
    it("should handle concurrent writes to different distributors safely", async () => {
      const { fileManager } = testContext;

      // Setup initial data
      const blockNumbers = {
        metadata: { chain_id: 42170 },
        blocks: { "2024-01-10": 237518127 },
      };
      fileManager.writeBlockNumbers(blockNumbers);

      const addrA = getAddress("0x1000000000000000000000000000000000000001");
      const addrB = getAddress("0x2000000000000000000000000000000000000002");
      const addrC = getAddress("0x3000000000000000000000000000000000000003");
      const addrD = getAddress("0x4000000000000000000000000000000000000004");

      const distributors = {
        metadata: {
          chain_id: 42170,
          arbowner_address: CONTRACTS.ARB_OWNER,
        },
        distributors: {
          [addrA]: {
            type: DistributorType.L2_BASE_FEE,
            block: 237518127,
            date: "2024-01-10",
            tx_hash: "0x" + "a".repeat(64),
            method: "direct",
            owner: CONTRACTS.ARB_OWNER,
            event_data: "{}",
            is_reward_distributor: true,
            distributor_address: addrA,
          },
          [addrB]: {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 237518127,
            date: "2024-01-10",
            tx_hash: "0x" + "b".repeat(64),
            method: "direct",
            owner: CONTRACTS.ARB_OWNER,
            event_data: "{}",
            is_reward_distributor: true,
            distributor_address: addrB,
          },
          [addrC]: {
            type: DistributorType.L1_BASE_FEE,
            block: 237518127,
            date: "2024-01-10",
            tx_hash: "0x" + "c".repeat(64),
            method: "direct",
            owner: CONTRACTS.ARB_OWNER,
            event_data: "{}",
            is_reward_distributor: false,
            distributor_address: addrC,
          },
        },
      };
      fileManager.writeDistributors(distributors);

      // Define concurrent operations
      const operations = [
        // Write balances to distributor A
        () =>
          fileManager.writeDistributorBalances(addrA, {
            metadata: {
              chain_id: 42170,
              reward_distributor: addrA,
            },
            balances: {
              "2024-01-10": {
                block_number: 237518127,
                balance_wei: "1000000000000000000",
              },
            },
          }),
        // Write outflows to distributor B
        () =>
          fileManager.writeDistributorOutflows(addrB, {
            metadata: {
              chain_id: 42170,
              reward_distributor: addrB,
            },
            outflows: {
              "2024-01-10": {
                block_number: 237518127,
                total_outflow_wei: "500000000000000000",
                events: [
                  {
                    recipient: addrD,
                    value_wei: "500000000000000000",
                    tx_hash: "0x" + "d".repeat(64),
                  },
                ],
              },
            },
          }),
        // Update block numbers
        () =>
          fileManager.writeBlockNumbers({
            metadata: { chain_id: 42170 },
            blocks: {
              "2024-01-10": 237518127,
              "2024-01-11": 237946584,
            },
          }),
        // Add new distributor
        () => {
          const currentDistributors = fileManager.readDistributors()!;
          currentDistributors.distributors[addrD] = {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 237946584,
            date: "2024-01-11",
            tx_hash: "0x" + "e".repeat(64),
            method: "factory",
            owner: CONTRACTS.ARB_OWNER,
            event_data: JSON.stringify({
              factory: getAddress("0x5000000000000000000000000000000000000005"),
            }),
            is_reward_distributor: true,
            distributor_address: addrD,
          };
          fileManager.writeDistributors(currentDistributors);
        },
      ];

      // Execute all operations concurrently
      console.log("Executing concurrent operations...");
      await Promise.all(
        operations.map(
          (op) =>
            new Promise((resolve) => {
              // Add small random delay to increase chance of actual concurrency
              setTimeout(() => {
                op();
                resolve(undefined);
              }, Math.random() * 10);
            }),
        ),
      );

      // Verify no data corruption or lost writes
      console.log("Verifying data integrity after concurrent operations...");

      // Check block numbers
      const finalBlockNumbers = fileManager.readBlockNumbers();
      expect(finalBlockNumbers).toBeDefined();
      expect(finalBlockNumbers!.blocks["2024-01-11"]).toBe(237946584);

      // Check distributor A balances
      const balancesA = fileManager.readDistributorBalances(addrA);
      expect(balancesA).toBeDefined();
      expect(balancesA?.balances["2024-01-10"]?.balance_wei).toBe(
        "1000000000000000000",
      );

      // Check distributor B outflows
      const outflowsB = fileManager.readDistributorOutflows(addrB);
      expect(outflowsB).toBeDefined();
      expect(outflowsB?.outflows["2024-01-10"]?.total_outflow_wei).toBe(
        "500000000000000000",
      );

      // Check new distributor was added
      const finalDistributors = fileManager.readDistributors();
      expect(finalDistributors).toBeDefined();
      expect(finalDistributors!.distributors).toHaveProperty(addrD);

      // Verify all distributors still exist
      expect(Object.keys(finalDistributors!.distributors)).toHaveLength(4);

      // Check no .tmp files left behind
      const checkForTmpFiles = (dir: string): boolean => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (checkForTmpFiles(fullPath)) return true;
          } else if (entry.name.endsWith(".tmp")) {
            return true;
          }
        }
        return false;
      };

      const hasTmpFiles = checkForTmpFiles(
        path.join(testContext.tempDir, "store"),
      );
      expect(hasTmpFiles).toBe(false);
    });
  });
});
