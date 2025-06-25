import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { FeeCalculator } from "../../src/fee-calculator";
import { FileManager } from "../../src/types";

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
          balanceWei: string,
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

      // Note: Current implementation only accepts currentBalanceWei
      // After fix, it should accept both previousBalanceWei and currentBalanceWei
      const result = createDailyEntry(
        date,
        currentBalanceWei,
        balanceChangeWei,
        distributionsWei,
        distributionsCount,
      );

      // This test will FAIL with current implementation because:
      // - start_balance_wei is set to currentBalanceWei instead of previousBalanceWei
      // - Both start and end are set to the same value
      expect(result.date).toBe(date);
      expect(result.start_balance_wei).toBe(previousBalanceWei); // FAILS: Gets currentBalanceWei
      expect(result.end_balance_wei).toBe(currentBalanceWei);
      expect(result.balance_change_wei).toBe("-20000000000000000000");
      expect(result.distributions_wei).toBe("25000000000000000000");
      expect(result.distributions_count).toBe(5);
      expect(result.total_wei).toBe("5000000000000000000"); // -20 + 25 = 5
    });
  });
});
