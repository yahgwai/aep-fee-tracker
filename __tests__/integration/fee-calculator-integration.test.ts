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
    it("should calculate fees for first distributor and first date", () => {
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
          "2022-07-13": {
            block_number: 1000,
            balance_wei: "2000000000000000000",
          },
          "2022-07-14": {
            block_number: 2000,
            balance_wei: "3000000000000000000",
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
      expect(entry!.balance_change_wei).toBe("0");
      expect(entry!.distributions_wei).toBe("0");
      expect(entry!.distributions_count).toBe(0);
      expect(entry!.total_wei).toBe("0");
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

    it("should process only the first date when multiple dates exist", () => {
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

      // Verify only first date is processed
      const feeReport = fileManager.readFeeReport();
      const distributorReport =
        feeReport!.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorReport).toHaveLength(1);
      expect(distributorReport![0]!.date).toBe("2022-07-12"); // First date when sorted
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
  });
});
