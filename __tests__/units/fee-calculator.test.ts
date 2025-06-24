import { FileManager } from "../../src/file-manager";
import { FeeCalculator } from "../../src/fee-calculator";
import {
  DistributorType,
  DistributorsData,
  BalanceData,
  FeeReport,
} from "../../src/types";

jest.mock("../../src/file-manager");

describe("FeeCalculator", () => {
  let mockFileManager: jest.Mocked<FileManager>;

  beforeEach(() => {
    mockFileManager = {
      readDistributors: jest.fn(),
      readDistributorBalances: jest.fn(),
      writeFeeReport: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;
  });

  describe("constructor", () => {
    it("can be instantiated with FileManager dependency", () => {
      const calculator = new FeeCalculator(mockFileManager);
      expect(calculator).toBeDefined();
      expect(calculator).toBeInstanceOf(FeeCalculator);
    });

    it("stores FileManager as readonly property", () => {
      const calculator = new FeeCalculator(mockFileManager);
      expect(calculator.fileManager).toBe(mockFileManager);
    });
  });

  describe("calculateFees", () => {
    let calculator: FeeCalculator;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
    });

    it("exists as a method on FeeCalculator instance", () => {
      expect(calculator.calculateFees).toBeDefined();
      expect(typeof calculator.calculateFees).toBe("function");
    });

    it("accepts optional distributorAddress parameter", () => {
      expect(calculator.calculateFees.length).toBeLessThanOrEqual(1);
    });

    it("returns void", () => {
      const result = calculator.calculateFees();
      expect(result).toBeUndefined();
    });
  });

  describe("calculateFees - reading distributor data", () => {
    let calculator: FeeCalculator;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
    });

    it("reads distributor list from FileManager", () => {
      mockFileManager.readDistributors.mockReturnValue(undefined);

      calculator.calculateFees();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });

    it("handles empty distributor data gracefully", () => {
      mockFileManager.readDistributors.mockReturnValue(undefined);

      expect(() => calculator.calculateFees()).not.toThrow();
    });

    it("handles distributor data with empty distributors object", () => {
      const emptyDistributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {},
      };
      mockFileManager.readDistributors.mockReturnValue(emptyDistributorsData);

      expect(() => calculator.calculateFees()).not.toThrow();
    });
  });

  describe("calculateFees - processing first distributor", () => {
    let calculator: FeeCalculator;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
      mockDistributorsData = {
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
    });

    it("reads balance data for the first distributor only", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      calculator.calculateFees();

      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledTimes(1);
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });

    it("handles missing balance data for first distributor", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      expect(() => calculator.calculateFees()).not.toThrow();
    });

    it("handles balance data with empty balances object", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const emptyBalanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {},
      };
      mockFileManager.readDistributorBalances.mockReturnValue(emptyBalanceData);

      expect(() => calculator.calculateFees()).not.toThrow();
    });
  });

  describe("calculateFees - processing first date", () => {
    let calculator: FeeCalculator;
    let mockDistributorsData: DistributorsData;
    let mockBalanceData: BalanceData;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
      mockDistributorsData = {
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
      mockBalanceData = {
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
    });

    it("processes only the first date from balance data", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      // Will verify in writeFeeReport call that only first date is processed
      expect(mockFileManager.writeFeeReport).toHaveBeenCalledTimes(1);
    });
  });

  describe("calculateFees - writing fee report", () => {
    let calculator: FeeCalculator;
    let mockDistributorsData: DistributorsData;
    let mockBalanceData: BalanceData;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
      mockDistributorsData = {
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
      mockBalanceData = {
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
    });

    it("writes fee report with correct structure", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      expect(mockFileManager.writeFeeReport).toHaveBeenCalledTimes(1);
      const reportArg = mockFileManager.writeFeeReport.mock.calls[0]![0];
      expect(reportArg).toHaveProperty("metadata");
      expect(reportArg).toHaveProperty("distributors");
      expect(reportArg.metadata.chain_id).toBe(42170);
    });

    it("creates fee report entry with balance_change_wei as 0 for first day", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      const reportArg = mockFileManager.writeFeeReport.mock
        .calls[0]![0] as FeeReport;
      const distributorEntries =
        reportArg.distributors["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(distributorEntries).toHaveLength(1);
      expect(distributorEntries![0]!.date).toBe("2022-07-12");
      expect(distributorEntries![0]!.balance_change_wei).toBe("0");
    });

    it("includes correct balance values in fee report entry", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      const reportArg = mockFileManager.writeFeeReport.mock
        .calls[0]![0] as FeeReport;
      const entry =
        reportArg.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ]![0];
      expect(entry!.start_balance_wei).toBe("1000000000000000000");
      expect(entry!.end_balance_wei).toBe("1000000000000000000");
    });

    it("sets distributions_wei and distributions_count to 0 (no event processing)", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      const reportArg = mockFileManager.writeFeeReport.mock
        .calls[0]![0] as FeeReport;
      const entry =
        reportArg.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ]![0];
      expect(entry!.distributions_wei).toBe("0");
      expect(entry!.distributions_count).toBe(0);
    });

    it("calculates total_wei as balance_change + distributions (0 + 0 = 0)", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);

      calculator.calculateFees();

      const reportArg = mockFileManager.writeFeeReport.mock
        .calls[0]![0] as FeeReport;
      const entry =
        reportArg.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ]![0];
      expect(entry!.total_wei).toBe("0");
    });
  });

  describe("calculateFees - with distributorAddress parameter", () => {
    let calculator: FeeCalculator;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      calculator = new FeeCalculator(mockFileManager);
      mockDistributorsData = {
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
    });

    it("ignores distributorAddress parameter and processes first distributor", () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      // Pass a different address than the first distributor
      calculator.calculateFees("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");

      // Should still read balance for the first distributor
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });
  });
});
