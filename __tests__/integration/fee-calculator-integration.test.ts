import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/infrastructure/storage/test-utils";
import { FeeCalculator } from "../../src/core/fee-calculation/fee-calculator";
import {
  DistributorType,
  DistributorsData,
  BalanceData,
} from "../../src/types";

describe("FeeCalculator - Integration Tests", () => {
  let testContext: TestContext;
  let calculator: FeeCalculator;

  beforeEach(() => {
    testContext = setupTestEnvironment();
    calculator = new FeeCalculator(testContext.fileManager);
  });

  afterEach(() => {
    cleanupTestEnvironment(testContext.tempDir);
  });

  describe("calculateFees", () => {
    it("should calculate fees for first distributor with single date", () => {
      const { fileManager } = testContext;

      // Setup test data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
        },
      };

      // Write test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();
      expect(feeReport!.metadata.chain_id).toBe(42170);

      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(1);

      const entry = distributorReport![0];
      expect(entry!.date).toBe("2022-07-12");
      expect(entry!.start_balance_wei).toBe("0"); // First day starts with 0
      expect(entry!.end_balance_wei).toBe("1000000000000000000");
      expect(entry!.balance_change_wei).toBe("1000000000000000000");
      expect(entry!.distributions_wei).toBe("0");
      expect(entry!.distributions_count).toBe(0);
      expect(entry!.total_wei).toBe("1000000000000000000");
    });

    it("should handle empty distributor data", () => {
      const { fileManager } = testContext;

      // Calculate fees without any data
      calculator.calculateFees();

      // Should not write any fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeUndefined();
    });

    it("should throw error when distributorAddress provided but no distributors exist", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {},
      };

      fileManager.writeDistributors(distributorsData);

      // Should throw when specific distributor requested but none exist
      expect(() => {
        calculator.calculateFees("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
      }).toThrow(
        "No distributors found in data while searching for 0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      );
    });

    it("should handle distributor with no balance data", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);

      // Calculate fees
      calculator.calculateFees();

      // Should not write any fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeUndefined();
    });

    it("should handle distributor with empty balance data", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const emptyBalanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {},
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        emptyBalanceData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Should not write any fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeUndefined();
    });

    it("should process all dates when multiple dates exist", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "3000000000000000000",
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "2000000000000000000",
          },
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Verify all dates are processed
      const feeReport = fileManager.readFeeReport();
      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(3);
      expect(distributorReport![0]!.date).toBe("2022-07-12"); // First date when sorted
      expect(distributorReport![1]!.date).toBe("2022-07-13");
      expect(distributorReport![2]!.date).toBe("2022-07-14");
    });

    it("should filter to specified distributor when distributorAddress is provided", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      const balanceData1: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
        },
      };

      const balanceData2: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        },
        balances: {
          "2022-07-13": {
            block_number: 200,
            balance_wei: "2000000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData1,
      );
      fileManager.writeDistributorBalances(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        balanceData2,
      );

      // Pass a specific distributor address
      calculator.calculateFees("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");

      // Should only process the specified distributor
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();
      expect(feeReport!.distributors).not.toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(feeReport!.distributors).toHaveProperty(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      );

      // Verify the data for the specified distributor
      const distributorReport =
        feeReport!.distributors["0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"];
      expect(distributorReport).toHaveLength(1);
      expect(distributorReport![0]!.date).toBe("2022-07-13");
      expect(distributorReport![0]!.balance_change_wei).toBe(
        "2000000000000000000",
      );
    });

    it("should throw error when distributorAddress does not match any distributor", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      // Pass a non-existent distributor address
      expect(() => {
        calculator.calculateFees(
          "0xNonExistentDistributor1234567890abcdef1234",
        );
      }).toThrow(
        "Distributor address 0xNonExistentDistributor1234567890abcdef1234 not found in distributor data",
      );
    });

    it("should process all distributors when distributorAddress is not provided", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      const balanceData1: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
        },
      };

      const balanceData2: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        },
        balances: {
          "2022-07-13": {
            block_number: 200,
            balance_wei: "2000000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData1,
      );
      fileManager.writeDistributorBalances(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        balanceData2,
      );

      // Call without distributorAddress parameter
      calculator.calculateFees();

      // Should process both distributors
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();
      expect(feeReport!.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(feeReport!.distributors).toHaveProperty(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      );
    });

    it("should calculate balance changes for multiple days", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "1500000000000000000",
          },
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "2500000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();

      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(3);

      // First day - balance change should be the balance itself (1 ETH)
      const day1 = distributorReport![0];
      expect(day1!.date).toBe("2022-07-12");
      expect(day1!.start_balance_wei).toBe("0"); // First day starts with 0
      expect(day1!.end_balance_wei).toBe("1000000000000000000");
      expect(day1!.balance_change_wei).toBe("1000000000000000000");
      expect(day1!.distributions_wei).toBe("0");
      expect(day1!.distributions_count).toBe(0);
      expect(day1!.total_wei).toBe("1000000000000000000");

      // Second day - balance change should be 500000000000000000 (1.5 - 1.0 ETH)
      const day2 = distributorReport![1];
      expect(day2!.date).toBe("2022-07-13");
      expect(day2!.start_balance_wei).toBe("1000000000000000000"); // Previous day's end balance
      expect(day2!.end_balance_wei).toBe("1500000000000000000");
      expect(day2!.balance_change_wei).toBe("500000000000000000");
      expect(day2!.distributions_wei).toBe("0");
      expect(day2!.distributions_count).toBe(0);
      expect(day2!.total_wei).toBe("500000000000000000");

      // Third day - balance change should be 1000000000000000000 (2.5 - 1.5 ETH)
      const day3 = distributorReport![2];
      expect(day3!.date).toBe("2022-07-14");
      expect(day3!.start_balance_wei).toBe("1500000000000000000"); // Previous day's end balance
      expect(day3!.end_balance_wei).toBe("2500000000000000000");
      expect(day3!.balance_change_wei).toBe("1000000000000000000");
      expect(day3!.distributions_wei).toBe("0");
      expect(day3!.distributions_count).toBe(0);
      expect(day3!.total_wei).toBe("1000000000000000000");
    });

    it("should sort dates chronologically before processing", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      // Dates intentionally out of order
      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "3000000000000000000",
          },
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "2000000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      calculator.calculateFees();

      const feeReport = fileManager.readFeeReport();
      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];

      // Verify dates are in chronological order
      expect(distributorReport![0]!.date).toBe("2022-07-12");
      expect(distributorReport![1]!.date).toBe("2022-07-13");
      expect(distributorReport![2]!.date).toBe("2022-07-14");

      // Verify balance changes are calculated based on sorted order
      expect(distributorReport![0]!.balance_change_wei).toBe(
        "1000000000000000000",
      ); // First day = balance itself
      expect(distributorReport![1]!.balance_change_wei).toBe(
        "1000000000000000000",
      );
      expect(distributorReport![2]!.balance_change_wei).toBe(
        "1000000000000000000",
      );
    });

    it("should handle decreasing balances with negative balance changes", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "3000000000000000000",
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "2000000000000000000",
          },
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "500000000000000000",
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      calculator.calculateFees();

      const feeReport = fileManager.readFeeReport();
      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];

      // First day - balance change should be the balance itself (3 ETH)
      expect(distributorReport![0]!.balance_change_wei).toBe(
        "3000000000000000000",
      );
      expect(distributorReport![0]!.total_wei).toBe("3000000000000000000");

      // Second day - balance decreased by 1 ETH
      expect(distributorReport![1]!.balance_change_wei).toBe(
        "-1000000000000000000",
      );
      expect(distributorReport![1]!.total_wei).toBe("-1000000000000000000");

      // Third day - balance decreased by 1.5 ETH
      expect(distributorReport![2]!.balance_change_wei).toBe(
        "-1500000000000000000",
      );
      expect(distributorReport![2]!.total_wei).toBe("-1500000000000000000");
    });

    it("should handle mixed balance changes", () => {
      const { fileManager } = testContext;

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000",
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "2500000000000000000", // +1.5 ETH
          },
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "2000000000000000000", // -0.5 ETH
          },
          "2022-07-15": {
            block_number: 3000,
            balance_wei: "4000000000000000000", // +2 ETH
          },
        },
      };

      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );

      calculator.calculateFees();

      const feeReport = fileManager.readFeeReport();
      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];

      expect(distributorReport).toHaveLength(4);

      // Day 1: First day, balance change = balance itself (1 ETH)
      expect(distributorReport![0]!.balance_change_wei).toBe(
        "1000000000000000000",
      );

      // Day 2: Balance increased by 1.5 ETH
      expect(distributorReport![1]!.balance_change_wei).toBe(
        "1500000000000000000",
      );

      // Day 3: Balance decreased by 0.5 ETH
      expect(distributorReport![2]!.balance_change_wei).toBe(
        "-500000000000000000",
      );

      // Day 4: Balance increased by 2 ETH
      expect(distributorReport![3]!.balance_change_wei).toBe(
        "2000000000000000000",
      );
    });

    it("should include distribution events in fee calculations", () => {
      const { fileManager } = testContext;

      // Setup distributors data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      // Setup balance data
      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000", // 1 ETH
          },
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "1500000000000000000", // 1.5 ETH
          },
        },
      };

      // Setup distribution events - one event on 2022-07-12
      const eventsData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 1000,
        },
        events: {
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0":
            {
              blockNumber: 150,
              transactionHash:
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "200000000000000000", // 0.2 ETH distribution
            },
        },
      };

      // Write test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );
      fileManager.writeRecipientRecievedEvents(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        eventsData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();

      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(2);

      // First day - should include distribution
      const day1 = distributorReport![0]!;
      expect(day1.date).toBe("2022-07-12");
      expect(day1.balance_change_wei).toBe("1000000000000000000"); // 1 ETH balance change
      expect(day1.distributions_wei).toBe("200000000000000000"); // 0.2 ETH distribution
      expect(day1.distributions_count).toBe(1);
      expect(day1.total_wei).toBe("1200000000000000000"); // 1.2 ETH total (1 + 0.2)

      // Second day - no distributions
      const day2 = distributorReport![1]!;
      expect(day2.date).toBe("2022-07-13");
      expect(day2.balance_change_wei).toBe("500000000000000000"); // 0.5 ETH balance change
      expect(day2.distributions_wei).toBe("0");
      expect(day2.distributions_count).toBe(0);
      expect(day2.total_wei).toBe("500000000000000000"); // 0.5 ETH total
    });

    it("should sum multiple distribution events on the same date", () => {
      const { fileManager } = testContext;

      // Setup distributors data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      // Setup balance data
      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000", // 1 ETH
          },
        },
      };

      // Setup multiple distribution events on the same date
      const eventsData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 200,
        },
        events: {
          "0x1111111111111111111111111111111111111111111111111111111111111111:0":
            {
              blockNumber: 100,
              transactionHash:
                "0x1111111111111111111111111111111111111111111111111111111111111111",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "100000000000000000", // 0.1 ETH
            },
          "0x2222222222222222222222222222222222222222222222222222222222222222:0":
            {
              blockNumber: 120,
              transactionHash:
                "0x2222222222222222222222222222222222222222222222222222222222222222",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "200000000000000000", // 0.2 ETH
            },
          "0x3333333333333333333333333333333333333333333333333333333333333333:0":
            {
              blockNumber: 150,
              transactionHash:
                "0x3333333333333333333333333333333333333333333333333333333333333333",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              value: "300000000000000000", // 0.3 ETH
            },
        },
      };

      // Write test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );
      fileManager.writeRecipientRecievedEvents(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        eventsData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();

      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(1);

      // Should sum all three events: 0.1 + 0.2 + 0.3 = 0.6 ETH
      const day1 = distributorReport![0]!;
      expect(day1.date).toBe("2022-07-12");
      expect(day1.balance_change_wei).toBe("1000000000000000000"); // 1 ETH balance change
      expect(day1.distributions_wei).toBe("600000000000000000"); // 0.6 ETH total distributions
      expect(day1.distributions_count).toBe(3); // 3 events
      expect(day1.total_wei).toBe("1600000000000000000"); // 1.6 ETH total (1 + 0.6)
    });

    it("should handle mixed dates with and without distribution events", () => {
      const { fileManager } = testContext;

      // Setup distributors data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      // Setup balance data for multiple days
      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 1000,
            balance_wei: "1000000000000000000", // 1 ETH
          },
          "2022-07-13": {
            block_number: 2000,
            balance_wei: "2000000000000000000", // 2 ETH
          },
          "2022-07-14": {
            block_number: 3000,
            balance_wei: "2500000000000000000", // 2.5 ETH
          },
          "2022-07-15": {
            block_number: 4000,
            balance_wei: "3000000000000000000", // 3 ETH
          },
        },
      };

      // Setup distribution events - some days have events, some don't
      const eventsData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 4000,
        },
        events: {
          // Day 1 - two events
          "0xaaaa000000000000000000000000000000000000000000000000000000000001:0":
            {
              blockNumber: 500,
              transactionHash:
                "0xaaaa000000000000000000000000000000000000000000000000000000000001",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "100000000000000000", // 0.1 ETH
            },
          "0xaaaa000000000000000000000000000000000000000000000000000000000002:0":
            {
              blockNumber: 800,
              transactionHash:
                "0xaaaa000000000000000000000000000000000000000000000000000000000002",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "150000000000000000", // 0.15 ETH
            },
          // Day 2 - no events
          // Day 3 - one event
          "0xcccc000000000000000000000000000000000000000000000000000000000001:0":
            {
              blockNumber: 2800,
              transactionHash:
                "0xcccc000000000000000000000000000000000000000000000000000000000001",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "300000000000000000", // 0.3 ETH
            },
          // Day 4 - no events
        },
      };

      // Write test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData,
      );
      fileManager.writeRecipientRecievedEvents(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        eventsData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();

      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(4);

      // Day 1: Balance change 1 ETH + distributions 0.25 ETH
      const day1 = distributorReport![0]!;
      expect(day1.date).toBe("2022-07-12");
      expect(day1.balance_change_wei).toBe("1000000000000000000");
      expect(day1.distributions_wei).toBe("250000000000000000"); // 0.1 + 0.15
      expect(day1.distributions_count).toBe(2);
      expect(day1.total_wei).toBe("1250000000000000000");

      // Day 2: Balance change 1 ETH + no distributions
      const day2 = distributorReport![1]!;
      expect(day2.date).toBe("2022-07-13");
      expect(day2.balance_change_wei).toBe("1000000000000000000");
      expect(day2.distributions_wei).toBe("0");
      expect(day2.distributions_count).toBe(0);
      expect(day2.total_wei).toBe("1000000000000000000");

      // Day 3: Balance change 0.5 ETH + distribution 0.3 ETH
      const day3 = distributorReport![2]!;
      expect(day3.date).toBe("2022-07-14");
      expect(day3.balance_change_wei).toBe("500000000000000000");
      expect(day3.distributions_wei).toBe("300000000000000000");
      expect(day3.distributions_count).toBe(1);
      expect(day3.total_wei).toBe("800000000000000000");

      // Day 4: Balance change 0.5 ETH + no distributions
      const day4 = distributorReport![3]!;
      expect(day4.date).toBe("2022-07-15");
      expect(day4.balance_change_wei).toBe("500000000000000000");
      expect(day4.distributions_wei).toBe("0");
      expect(day4.distributions_count).toBe(0);
      expect(day4.total_wei).toBe("500000000000000000");
    });

    it("should process all distributors, not just the first one", () => {
      const { fileManager } = testContext;

      // Setup distributors data with multiple distributors
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
          "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 300,
            date: "2022-07-14",
            tx_hash:
              "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 3",
            is_reward_distributor: true,
            distributor_address: "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD",
          },
        },
      };

      // Setup balance data for first distributor
      const balanceData1: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 1000,
            balance_wei: "1000000000000000000", // 1 ETH
          },
          "2022-07-13": {
            block_number: 2000,
            balance_wei: "1500000000000000000", // 1.5 ETH
          },
        },
      };

      // Setup balance data for second distributor
      const balanceData2: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        },
        balances: {
          "2022-07-13": {
            block_number: 2000,
            balance_wei: "2000000000000000000", // 2 ETH
          },
          "2022-07-14": {
            block_number: 3000,
            balance_wei: "2500000000000000000", // 2.5 ETH
          },
        },
      };

      // Setup balance data for third distributor
      const balanceData3: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD",
        },
        balances: {
          "2022-07-14": {
            block_number: 3000,
            balance_wei: "3000000000000000000", // 3 ETH
          },
        },
      };

      // Setup events for first distributor
      const eventsData1 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 2000,
        },
        events: {
          "0xaaaa000000000000000000000000000000000000000000000000000000000001:0":
            {
              blockNumber: 1500,
              transactionHash:
                "0xaaaa000000000000000000000000000000000000000000000000000000000001",
              logIndex: 0,
              address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              value: "100000000000000000", // 0.1 ETH
            },
        },
      };

      // Setup events for second distributor
      const eventsData2 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          last_scanned_block: 3000,
        },
        events: {
          "0xbbbb000000000000000000000000000000000000000000000000000000000001:0":
            {
              blockNumber: 2500,
              transactionHash:
                "0xbbbb000000000000000000000000000000000000000000000000000000000001",
              logIndex: 0,
              address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
              topics: ["0xRecipientRecievedTopic"],
              data: "0x",
              recipient: "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD",
              value: "200000000000000000", // 0.2 ETH
            },
        },
      };

      // Write all test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData1,
      );
      fileManager.writeDistributorBalances(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        balanceData2,
      );
      fileManager.writeDistributorBalances(
        "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD",
        balanceData3,
      );
      fileManager.writeRecipientRecievedEvents(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        eventsData1,
      );
      fileManager.writeRecipientRecievedEvents(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        eventsData2,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();
      expect(feeReport!.metadata.chain_id).toBe(42170);

      // Verify all three distributors are included in the report
      expect(feeReport!.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(feeReport!.distributors).toHaveProperty(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      );
      expect(feeReport!.distributors).toHaveProperty(
        "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD",
      );

      // Verify first distributor's data
      const distributor1Report =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributor1Report).toHaveLength(2);

      const d1Day1 = distributor1Report![0]!;
      expect(d1Day1.date).toBe("2022-07-12");
      expect(d1Day1.balance_change_wei).toBe("1000000000000000000"); // First day
      expect(d1Day1.distributions_wei).toBe("0");
      expect(d1Day1.total_wei).toBe("1000000000000000000");

      const d1Day2 = distributor1Report![1]!;
      expect(d1Day2.date).toBe("2022-07-13");
      expect(d1Day2.balance_change_wei).toBe("500000000000000000"); // 1.5 - 1.0
      expect(d1Day2.distributions_wei).toBe("100000000000000000"); // 0.1 ETH event
      expect(d1Day2.distributions_count).toBe(1);
      expect(d1Day2.total_wei).toBe("600000000000000000");

      // Verify second distributor's data
      const distributor2Report =
        feeReport!.distributors["0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"];
      expect(distributor2Report).toHaveLength(2);

      const d2Day1 = distributor2Report![0]!;
      expect(d2Day1.date).toBe("2022-07-13");
      expect(d2Day1.balance_change_wei).toBe("2000000000000000000"); // First day
      expect(d2Day1.distributions_wei).toBe("0");
      expect(d2Day1.total_wei).toBe("2000000000000000000");

      const d2Day2 = distributor2Report![1]!;
      expect(d2Day2.date).toBe("2022-07-14");
      expect(d2Day2.balance_change_wei).toBe("500000000000000000"); // 2.5 - 2.0
      expect(d2Day2.distributions_wei).toBe("200000000000000000"); // 0.2 ETH event
      expect(d2Day2.distributions_count).toBe(1);
      expect(d2Day2.total_wei).toBe("700000000000000000");

      // Verify third distributor's data
      const distributor3Report =
        feeReport!.distributors["0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD"];
      expect(distributor3Report).toHaveLength(1);

      const d3Day1 = distributor3Report![0]!;
      expect(d3Day1.date).toBe("2022-07-14");
      expect(d3Day1.balance_change_wei).toBe("3000000000000000000"); // First day
      expect(d3Day1.distributions_wei).toBe("0"); // No events
      expect(d3Day1.distributions_count).toBe(0);
      expect(d3Day1.total_wei).toBe("3000000000000000000");
    });

    it("should handle multiple distributors with mixed data availability", () => {
      const { fileManager } = testContext;

      // Setup distributors data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          // Distributor with balance and events
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          // Distributor with no balance data
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
          // Distributor with empty balance data
          "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 300,
            date: "2022-07-14",
            tx_hash:
              "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 3",
            is_reward_distributor: true,
            distributor_address: "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
          },
        },
      };

      // Setup balance data only for first distributor
      const balanceData1: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 1000,
            balance_wei: "1000000000000000000", // 1 ETH
          },
        },
      };

      // Empty balance data for third distributor
      const emptyBalanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
        },
        balances: {},
      };

      // Write test data
      fileManager.writeDistributors(distributorsData);
      fileManager.writeDistributorBalances(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        balanceData1,
      );
      // Second distributor has no balance data file at all
      fileManager.writeDistributorBalances(
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
        emptyBalanceData,
      );

      // Calculate fees
      calculator.calculateFees();

      // Read and verify the fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeDefined();

      // Only first distributor should be in report
      expect(Object.keys(feeReport!.distributors)).toHaveLength(1);
      expect(feeReport!.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(feeReport!.distributors).not.toHaveProperty(
        "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
      );
      expect(feeReport!.distributors).not.toHaveProperty(
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
      );
    });

    it("should handle when no distributors have valid data", () => {
      const { fileManager } = testContext;

      // Setup distributors data
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 200,
            date: "2022-07-13",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "event data 2",
            is_reward_distributor: true,
            distributor_address: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
          },
        },
      };

      // Write only distributors data, no balance data
      fileManager.writeDistributors(distributorsData);

      // Calculate fees
      calculator.calculateFees();

      // Should not write any fee report
      const feeReport = fileManager.readFeeReport();
      expect(feeReport).toBeUndefined();
    });
  });
});
