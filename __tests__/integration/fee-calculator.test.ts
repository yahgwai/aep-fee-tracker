import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import { FeeCalculator } from "../../src/core/fee-calculation/fee-calculator";
import { FileManager } from "../../src/infrastructure/storage/file-manager";
import {
  DistributorsData,
  BalanceData,
  RecipientRecievedEventData,
  RecipientRecievedEvent,
  FeeReport,
} from "../../src/types";

// Load test data from files
async function loadTestData() {
  const basePath = path.join(__dirname, "../test-data");

  // Load distributors data
  const distributorsPath = path.join(
    basePath,
    "distributor-detector/distributors.json",
  );
  const distributorsContent = await fs.readFile(distributorsPath, "utf-8");
  const distributorsData: DistributorsData = JSON.parse(distributorsContent);

  // Load expected results
  const expectedPath = path.join(
    basePath,
    "fee-calculator/expected-results.json",
  );
  const expectedContent = await fs.readFile(expectedPath, "utf-8");
  const expectedResults: FeeReport = JSON.parse(expectedContent);

  // Load balance data for each distributor
  const balanceData: Record<string, BalanceData> = {};
  for (const distributorAddress of Object.keys(distributorsData.distributors)) {
    const balancePath = path.join(
      basePath,
      `distributor-detector/balance_data/${distributorAddress}/balances.json`,
    );
    try {
      const balanceContent = await fs.readFile(balancePath, "utf-8");
      balanceData[distributorAddress] = JSON.parse(balanceContent);
    } catch {
      // Some distributors might not have balance data
    }
  }

  // Load recipient events for each distributor
  const eventData: Record<string, RecipientRecievedEventData> = {};
  for (const distributorAddress of Object.keys(distributorsData.distributors)) {
    const eventPath = path.join(
      basePath,
      `recipient-recieved/${distributorAddress}.json`,
    );
    try {
      const eventContent = await fs.readFile(eventPath, "utf-8");
      const rawEventData = JSON.parse(eventContent);

      // Transform test data to match expected structure
      eventData[distributorAddress] = {
        metadata: {
          chain_id: rawEventData.chain_id,
          reward_distributor: distributorAddress,
          last_scanned_block: rawEventData.block_range?.end || 0,
        },
        events:
          rawEventData.events?.reduce(
            (
              acc: Record<string, RecipientRecievedEvent>,
              event: RecipientRecievedEvent,
            ) => {
              const key = `${event.transactionHash}:${event.logIndex}`;
              acc[key] = event;
              return acc;
            },
            {} as Record<string, RecipientRecievedEvent>,
          ) || {},
      };
    } catch {
      // Some distributors might not have event data
    }
  }

  return { distributorsData, expectedResults, balanceData, eventData };
}

describe("FeeCalculator - Comprehensive Integration Tests with Real Data", () => {
  let testContext: TestContext;
  let calculator: FeeCalculator;
  let fileManager: FileManager;
  let testData: Awaited<ReturnType<typeof loadTestData>>;

  beforeEach(async () => {
    testContext = setupTestEnvironment();
    fileManager = testContext.fileManager as unknown as FileManager;
    calculator = new FeeCalculator(fileManager);
    testData = await loadTestData();
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("Processing All Distributors", () => {
    it("should calculate fees for all distributors and match expected results", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Write balance data for each distributor
      for (const [address, data] of Object.entries(testData.balanceData)) {
        fileManager.writeDistributorBalances(address, data);
      }

      // Write event data for each distributor
      for (const [address, data] of Object.entries(testData.eventData)) {
        fileManager.writeRecipientRecievedEvents(address, data);
      }

      // Calculate fees for all distributors
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Compare with expected results
      expect(actualReport!.metadata).toEqual(testData.expectedResults.metadata);

      // Verify all distributors are present
      const expectedDistributors = Object.keys(
        testData.expectedResults.distributors,
      );
      const actualDistributors = Object.keys(actualReport!.distributors);
      expect(actualDistributors.sort()).toEqual(expectedDistributors.sort());

      // Compare each distributor's fee data
      for (const distributorAddress of expectedDistributors) {
        const expectedData =
          testData.expectedResults.distributors[distributorAddress];
        const actualData = actualReport!.distributors[distributorAddress];

        expect(actualData).toBeDefined();
        expect(expectedData).toBeDefined();
        expect(actualData!.length).toBe(expectedData!.length);

        // Compare each daily entry
        for (let i = 0; i < expectedData!.length; i++) {
          expect(actualData![i]).toEqual(expectedData![i]);
        }
      }
    });
  });

  describe("Filtering to Specific Distributor", () => {
    it("should calculate fees only for specified distributor", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Write balance and event data for all distributors
      for (const [address, data] of Object.entries(testData.balanceData)) {
        fileManager.writeDistributorBalances(address, data);
      }
      for (const [address, data] of Object.entries(testData.eventData)) {
        fileManager.writeRecipientRecievedEvents(address, data);
      }

      // Test with a specific distributor that has data and is a reward distributor
      const targetDistributor = "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f";
      calculator.calculateFees(targetDistributor);

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Should only contain the specified distributor
      expect(Object.keys(actualReport!.distributors)).toHaveLength(1);
      expect(actualReport!.distributors).toHaveProperty(targetDistributor);

      // Compare with expected data for this distributor
      const expectedData =
        testData.expectedResults.distributors[targetDistributor];
      const actualData = actualReport!.distributors[targetDistributor];

      expect(actualData).toEqual(expectedData);
    });

    it("should throw error when filtering to a non-reward distributor", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Only write balance data for some distributors
      const distributorsWithBalanceData = [
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      ];
      for (const address of distributorsWithBalanceData) {
        if (testData.balanceData[address]) {
          fileManager.writeDistributorBalances(
            address,
            testData.balanceData[address],
          );
        }
      }

      // Try to calculate fees for a non-reward distributor
      // Note: This distributor exists but has is_reward_distributor: false
      const nonRewardDistributor = "0xdff90519a9DE6ad469D4f9839a9220C5D340B792";

      expect(() => {
        calculator.calculateFees(nonRewardDistributor);
      }).toThrow(
        "Distributor address 0xdff90519a9DE6ad469D4f9839a9220C5D340B792 is not a reward distributor and does not generate fee reports",
      );
    });
  });

  describe("Distributors with Only Balance Data (No Events)", () => {
    it("should calculate fees correctly for distributors without distribution events", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Use the first reward distributor which has many days with no events
      const targetDistributor = "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f";

      // Write only balance data (no events) for this distributor
      const balanceData = testData.balanceData[targetDistributor];
      expect(balanceData).toBeDefined();
      fileManager.writeDistributorBalances(targetDistributor, balanceData!);

      // Calculate fees
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Verify the distributor is in the report
      expect(actualReport!.distributors).toHaveProperty(targetDistributor);

      const actualData = actualReport!.distributors[targetDistributor];
      const expectedData =
        testData.expectedResults.distributors[targetDistributor];

      // Since we didn't write any event data, all distributions should be 0
      expect(actualData).toBeDefined();
      expect(expectedData).toBeDefined();
      expect(actualData!.length).toBe(expectedData!.length);

      // Verify all entries have zero distributions (because we didn't write event data)
      for (const entry of actualData!) {
        expect(entry.distributions_count).toBe(0);
        expect(entry.distributions_wei).toBe("0");
      }
    });
  });

  describe("Distributors with Both Balance and Event Data", () => {
    it("should calculate fees correctly including distribution events", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Find distributors with both balance and event data
      const distributorsWithEvents: string[] = [];
      for (const [address, entries] of Object.entries(
        testData.expectedResults.distributors,
      )) {
        const hasEvents = entries.some(
          (entry) =>
            entry.distributions_count > 0 || entry.distributions_wei !== "0",
        );
        if (
          hasEvents &&
          testData.balanceData[address] &&
          testData.eventData[address]
        ) {
          distributorsWithEvents.push(address);
        }
      }

      // Write both balance and event data for these distributors
      for (const address of distributorsWithEvents) {
        if (testData.balanceData[address]) {
          fileManager.writeDistributorBalances(
            address,
            testData.balanceData[address],
          );
        }
        if (testData.eventData[address]) {
          fileManager.writeRecipientRecievedEvents(
            address,
            testData.eventData[address],
          );
        }
      }

      // Calculate fees
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Verify data for distributors with events
      for (const address of distributorsWithEvents) {
        const actualData = actualReport!.distributors[address];
        const expectedData = testData.expectedResults.distributors[address];

        expect(actualData).toBeDefined();
        expect(actualData).toEqual(expectedData);

        // Verify at least some entries have distributions
        const hasDistributions = actualData!.some(
          (entry) =>
            entry.distributions_count > 0 || entry.distributions_wei !== "0",
        );
        expect(hasDistributions).toBe(true);
      }
    });
  });

  describe("Edge Cases - First Day Calculations", () => {
    it("should correctly calculate first day balance change as the balance itself", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Write balance data for all distributors
      for (const [address, data] of Object.entries(testData.balanceData)) {
        fileManager.writeDistributorBalances(address, data);
      }

      // Write event data for distributors that have it
      for (const [address, data] of Object.entries(testData.eventData)) {
        fileManager.writeRecipientRecievedEvents(address, data);
      }

      // Calculate fees
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // For each distributor, verify the first day's balance change equals the balance
      for (const [address, entries] of Object.entries(
        actualReport!.distributors,
      )) {
        if (entries.length > 0) {
          const firstEntry = entries[0]!;
          const expectedEntries =
            testData.expectedResults.distributors[address];
          if (expectedEntries && expectedEntries.length > 0) {
            const expectedFirstEntry = expectedEntries[0];

            // First day balance change should equal the end balance
            expect(firstEntry.balance_change_wei).toBe(
              firstEntry.end_balance_wei,
            );
            expect(firstEntry).toEqual(expectedFirstEntry);
          }
        }
      }
    });
  });

  describe("Fee Report Structure Validation", () => {
    it("should generate fee reports with correct structure and data types", () => {
      // Setup test data
      fileManager.writeDistributors(testData.distributorsData);

      // Write all available data
      for (const [address, data] of Object.entries(testData.balanceData)) {
        fileManager.writeDistributorBalances(address, data);
      }
      for (const [address, data] of Object.entries(testData.eventData)) {
        fileManager.writeRecipientRecievedEvents(address, data);
      }

      // Calculate fees
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Validate metadata
      expect(actualReport!.metadata).toBeDefined();
      expect(typeof actualReport!.metadata.chain_id).toBe("number");
      expect(actualReport!.metadata.chain_id).toBe(42170);

      // Validate distributor entries
      expect(actualReport!.distributors).toBeDefined();
      expect(typeof actualReport!.distributors).toBe("object");

      for (const [address, entries] of Object.entries(
        actualReport!.distributors,
      )) {
        // Validate address format
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // Validate entries array
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);

        // Validate each entry structure
        for (const entry of entries) {
          expect(entry).toHaveProperty("date");
          expect(entry).toHaveProperty("start_balance_wei");
          expect(entry).toHaveProperty("end_balance_wei");
          expect(entry).toHaveProperty("balance_change_wei");
          expect(entry).toHaveProperty("distributions_wei");
          expect(entry).toHaveProperty("distributions_count");
          expect(entry).toHaveProperty("total_wei");

          // Validate data types
          expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(typeof entry.start_balance_wei).toBe("string");
          expect(typeof entry.end_balance_wei).toBe("string");
          expect(typeof entry.balance_change_wei).toBe("string");
          expect(typeof entry.distributions_wei).toBe("string");
          expect(typeof entry.distributions_count).toBe("number");
          expect(typeof entry.total_wei).toBe("string");

          // Validate numeric strings
          expect(entry.start_balance_wei).toMatch(/^-?\d+$/);
          expect(entry.end_balance_wei).toMatch(/^-?\d+$/);
          expect(entry.balance_change_wei).toMatch(/^-?\d+$/);
          expect(entry.distributions_wei).toMatch(/^-?\d+$/);
          expect(entry.total_wei).toMatch(/^-?\d+$/);
        }
      }
    });
  });

  describe("Complete Integration Test", () => {
    it("should process all test data and produce exact expected results", () => {
      // Setup all test data
      fileManager.writeDistributors(testData.distributorsData);

      // Write all balance data
      for (const [address, data] of Object.entries(testData.balanceData)) {
        fileManager.writeDistributorBalances(address, data);
      }

      // Write all event data
      for (const [address, data] of Object.entries(testData.eventData)) {
        fileManager.writeRecipientRecievedEvents(address, data);
      }

      // Calculate fees for all distributors
      calculator.calculateFees();

      // Read the generated fee report
      const actualReport = fileManager.readFeeReport();
      expect(actualReport).toBeDefined();

      // Deep comparison with expected results
      expect(actualReport).toEqual(testData.expectedResults);
    });
  });
});
