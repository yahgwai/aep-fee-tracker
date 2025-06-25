import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { FeeCalculator } from "../../src/fee-calculator";
import { FileManager, DistributorType } from "../../src/types";

describe("FeeCalculator Unit Tests", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let calculator: FeeCalculator;

  beforeEach(() => {
    // Create a mock FileManager
    mockFileManager = {
      readBlockNumbers: jest.fn(),
      writeBlockNumbers: jest.fn(),
      readDistributors: jest.fn(),
      writeDistributors: jest.fn(),
      readDistributorBalances: jest.fn(),
      writeDistributorBalances: jest.fn(),
      readRecipientRecievedEvents: jest.fn(),
      writeRecipientRecievedEvents: jest.fn(),
      readFeeReport: jest.fn(),
      writeFeeReport: jest.fn(),
      ensureStoreDirectory: jest.fn(),
      validateAddress: jest.fn(),
      formatDate: jest.fn(),
      validateDateFormat: jest.fn(),
      validateBlockNumber: jest.fn(),
      validateWeiValue: jest.fn(),
      validateTransactionHash: jest.fn(),
      validateEnumValue: jest.fn(),
    } as jest.Mocked<FileManager>;

    calculator = new FeeCalculator(mockFileManager);
  });

  describe("createDailyEntry", () => {
    it("should set start_balance_wei to previous balance and end_balance_wei to current balance", () => {
      // Test data matching the spec example
      const date = "2024-01-15";
      const previousBalanceWei = "1500000000000000000000"; // 1500 ETH (start balance)
      const currentBalanceWei = "1480000000000000000000"; // 1480 ETH (end balance)
      const balanceChangeWei = BigInt("-20000000000000000000"); // -20 ETH
      const distributionsWei = BigInt("25000000000000000000"); // 25 ETH
      const distributionsCount = 5;

      // Access private method through reflection for unit testing
      // This test documents the EXPECTED behavior after fix
      // Using type assertion to access private method for testing purposes
      const calculatorWithPrivates = calculator as unknown as {
        createDailyEntry: (
          date: string,
          previousBalanceWei: string,
          currentBalanceWei: string,
          balanceChangeWei: bigint,
          distributionsWei: bigint,
          distributionsCount: number,
        ) => {
          date: string;
          start_balance_wei: string;
          end_balance_wei: string;
          balance_change_wei: string;
          distributions_wei: string;
          distributions_count: number;
          total_wei: string;
        };
      };
      const createDailyEntry =
        calculatorWithPrivates.createDailyEntry.bind(calculator);

      // Now the implementation accepts both previousBalanceWei and currentBalanceWei
      const result = createDailyEntry(
        date,
        previousBalanceWei,
        currentBalanceWei,
        balanceChangeWei,
        distributionsWei,
        distributionsCount,
      );

      // Verify the result
      expect(result.date).toBe(date);
      expect(result.start_balance_wei).toBe(previousBalanceWei);
      expect(result.end_balance_wei).toBe(currentBalanceWei);
      expect(result.balance_change_wei).toBe("-20000000000000000000");
      expect(result.distributions_wei).toBe("25000000000000000000");
      expect(result.distributions_count).toBe(5);
      expect(result.total_wei).toBe("5000000000000000000"); // -20 + 25 = 5
    });
  });

  describe("calculateFees - reward distributor filtering", () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
    });

    it("skips distributors where is_reward_distributor is false", () => {
      const mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xNonRewardDistributor": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonRewardDistributor",
          },
          "0xRewardDistributor": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor",
          },
        },
      };

      const mockBalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0xRewardDistributor",
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "1000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockImplementation((address) => {
        if (address === "0xRewardDistributor") {
          return mockBalanceData;
        }
        return undefined;
      });
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      calculator.calculateFees();

      // Should only read balances for the reward distributor
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0xRewardDistributor",
      );
      expect(mockFileManager.readDistributorBalances).not.toHaveBeenCalledWith(
        "0xNonRewardDistributor",
      );

      // Should write fee report with only the reward distributor
      expect(mockFileManager.writeFeeReport).toHaveBeenCalledWith(
        expect.objectContaining({
          distributors: expect.objectContaining({
            "0xRewardDistributor": expect.any(Array),
          }),
        }),
      );
      const writtenReport = mockFileManager.writeFeeReport.mock.calls[0]?.[0];
      expect(writtenReport).toBeDefined();
      expect(writtenReport!.distributors).not.toHaveProperty(
        "0xNonRewardDistributor",
      );
    });

    it("processes distributors where is_reward_distributor is true", () => {
      const mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xRewardDistributor1": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor1",
          },
          "0xRewardDistributor2": {
            type: DistributorType.L2_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor2",
          },
        },
      };

      const mockBalanceData1 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0xRewardDistributor1",
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "1000000000000000000",
          },
        },
      };

      const mockBalanceData2 = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0xRewardDistributor2",
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "2000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockImplementation((address) => {
        if (address === "0xRewardDistributor1") {
          return mockBalanceData1;
        }
        if (address === "0xRewardDistributor2") {
          return mockBalanceData2;
        }
        return undefined;
      });
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      calculator.calculateFees();

      // Should read balances for both reward distributors
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0xRewardDistributor1",
      );
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0xRewardDistributor2",
      );

      // Should write fee report with both reward distributors
      expect(mockFileManager.writeFeeReport).toHaveBeenCalledWith(
        expect.objectContaining({
          distributors: expect.objectContaining({
            "0xRewardDistributor1": expect.any(Array),
            "0xRewardDistributor2": expect.any(Array),
          }),
        }),
      );
    });

    it("skips all distributors when none are reward distributors", () => {
      const mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xNonReward1": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward1",
          },
          "0xNonReward2": {
            type: DistributorType.L2_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward2",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      calculator.calculateFees();

      // Should not read balances for any distributors
      expect(mockFileManager.readDistributorBalances).not.toHaveBeenCalled();

      // Should not write any fee report
      expect(mockFileManager.writeFeeReport).not.toHaveBeenCalled();
    });
  });
});
