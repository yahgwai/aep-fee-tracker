import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { BalanceFetcher } from "../../src/balance-fetcher";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("BalanceFetcher Integration", () => {
  let tempDir: string;
  let fileManager: FileManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "balance-fetcher-test-"));
    fileManager = new FileManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("integrates parsing, fetching, and saving balance data", async () => {
    // Load test data
    const rawEvents = require("../test-data/distributor-detector/distributor-creation-events-raw.json");
    const blockNumbersData = require("../test-data/distributor-detector/block_numbers.json");

    // Parse addresses
    const addresses = BalanceFetcher.parseDistributorAddresses(
      rawEvents.events,
    );
    const uniqueAddresses = [...new Set(addresses)];
    expect(uniqueAddresses).toHaveLength(5); // 5 unique addresses in test data

    // Mock provider
    const mockProvider = {
      getBalance: jest.fn().mockResolvedValue(BigInt("1234567890000000000")),
    } as unknown as ethers.Provider;

    // Use a subset of blocks for testing
    const testBlockNumbers = [120, 155];

    // Fetch balances
    const allBalances = await BalanceFetcher.fetchAllDistributorBalances(
      mockProvider,
      uniqueAddresses.slice(0, 2), // Test with first 2 addresses
      testBlockNumbers,
    );

    // Save balance data
    await BalanceFetcher.saveBalanceData(
      fileManager,
      allBalances,
      blockNumbersData,
    );

    // Verify files were created
    const savedAddresses = uniqueAddresses.slice(0, 2);
    for (const address of savedAddresses) {
      const balanceData = fileManager.readDistributorBalances(address);
      expect(balanceData).toBeDefined();
      expect(balanceData!.metadata.chain_id).toBe(42170);
      expect(balanceData!.metadata.reward_distributor).toBe(address);

      // Check that we have balance data for the expected dates
      const expectedDates = ["2022-07-11", "2022-07-12"];
      for (const date of expectedDates) {
        if (
          blockNumbersData.blocks[date] &&
          testBlockNumbers.includes(blockNumbersData.blocks[date])
        ) {
          expect(balanceData!.balances[date]).toBeDefined();
          expect(balanceData!.balances[date]!.balance_wei).toBe(
            "1234567890000000000",
          );
        }
      }
    }
  });
});
