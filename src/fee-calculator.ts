import { FileManager, FeeReport, CHAIN_IDS } from "./types";

// Type for individual fee report entries
type FeeReportEntry = {
  date: string;
  start_balance_wei: string;
  end_balance_wei: string;
  balance_change_wei: string;
  distributions_wei: string;
  distributions_count: number;
  total_wei: string;
};

// Constants for fee calculation
const FIRST_DAY_BALANCE_CHANGE = "0";
const NO_DISTRIBUTIONS = "0";
const NO_DISTRIBUTIONS_COUNT = 0;

export class FeeCalculator {
  constructor(public readonly fileManager: FileManager) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateFees(_distributorAddress?: string): void {
    // Read distributor list
    const distributorsData = this.fileManager.readDistributors();
    if (!distributorsData) return;

    // Get first distributor
    const distributorAddresses = Object.keys(distributorsData.distributors);
    if (distributorAddresses.length === 0) return;

    const firstDistributorAddress = distributorAddresses[0]!;

    // Read balance data for the first distributor
    const balanceData = this.fileManager.readDistributorBalances(
      firstDistributorAddress,
    );
    if (!balanceData) return;

    // Get all dates from balance data and sort chronologically
    const sortedDates = Object.keys(balanceData.balances).sort();
    if (sortedDates.length === 0) return;

    // Process all dates to create daily entries
    const dailyEntries = this.createDailyEntries(
      sortedDates,
      balanceData.balances,
    );

    // Create and write fee report
    const feeReport: FeeReport = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_NOVA,
      },
      distributors: {
        [firstDistributorAddress]: dailyEntries,
      },
    };

    this.fileManager.writeFeeReport(feeReport);
  }

  private createDailyEntries(
    sortedDates: string[],
    balances: { [date: string]: { block_number: number; balance_wei: string } },
  ): FeeReportEntry[] {
    const dailyEntries: FeeReportEntry[] = [];
    let previousBalanceWei: string | null = null;

    for (const date of sortedDates) {
      const currentBalance = balances[date]!;
      const balanceChangeWei = this.calculateBalanceChange(
        currentBalance.balance_wei,
        previousBalanceWei,
      );

      dailyEntries.push(
        this.createDailyEntry(
          date,
          currentBalance.balance_wei,
          balanceChangeWei,
        ),
      );
      previousBalanceWei = currentBalance.balance_wei;
    }

    return dailyEntries;
  }

  private calculateBalanceChange(
    currentBalanceWei: string,
    previousBalanceWei: string | null,
  ): string {
    if (previousBalanceWei === null) {
      return FIRST_DAY_BALANCE_CHANGE;
    }

    const currentBigInt = BigInt(currentBalanceWei);
    const previousBigInt = BigInt(previousBalanceWei);
    const changeWei = currentBigInt - previousBigInt;

    return changeWei.toString();
  }

  private createDailyEntry(
    date: string,
    balanceWei: string,
    balanceChangeWei: string,
  ): FeeReportEntry {
    return {
      date,
      start_balance_wei: balanceWei,
      end_balance_wei: balanceWei,
      balance_change_wei: balanceChangeWei,
      distributions_wei: NO_DISTRIBUTIONS,
      distributions_count: NO_DISTRIBUTIONS_COUNT,
      total_wei: balanceChangeWei, // Since distributions are always 0 for now
    };
  }
}
