import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestContext,
} from "../units/file-manager/test-utils";
import { FeeCalculator } from "../../src/fee-calculator";
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
      expect(entry!.start_balance_wei).toBe("1000000000000000000");
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

    it("should ignore distributorAddress parameter and process first distributor", () => {
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

      // Pass a different distributor address
      calculator.calculateFees("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");

      // Should still process the first distributor
      const feeReport = fileManager.readFeeReport();
      expect(feeReport!.distributors).toHaveProperty(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(feeReport!.distributors).not.toHaveProperty(
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
      expect(day1!.start_balance_wei).toBe("1000000000000000000");
      expect(day1!.end_balance_wei).toBe("1000000000000000000");
      expect(day1!.balance_change_wei).toBe("1000000000000000000");
      expect(day1!.distributions_wei).toBe("0");
      expect(day1!.distributions_count).toBe(0);
      expect(day1!.total_wei).toBe("1000000000000000000");

      // Second day - balance change should be 500000000000000000 (1.5 - 1.0 ETH)
      const day2 = distributorReport![1];
      expect(day2!.date).toBe("2022-07-13");
      expect(day2!.start_balance_wei).toBe("1500000000000000000");
      expect(day2!.end_balance_wei).toBe("1500000000000000000");
      expect(day2!.balance_change_wei).toBe("500000000000000000");
      expect(day2!.distributions_wei).toBe("0");
      expect(day2!.distributions_count).toBe(0);
      expect(day2!.total_wei).toBe("500000000000000000");

      // Third day - balance change should be 1000000000000000000 (2.5 - 1.5 ETH)
      const day3 = distributorReport![2];
      expect(day3!.date).toBe("2022-07-14");
      expect(day3!.start_balance_wei).toBe("2500000000000000000");
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
  });
});
