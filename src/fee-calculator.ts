import { FileManager, FeeReport, CHAIN_IDS } from "./types";

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

    // Get first date from balance data
    const balanceDates = Object.keys(balanceData.balances).sort();
    if (balanceDates.length === 0) return;

    const firstDate = balanceDates[0]!;
    const firstBalance = balanceData.balances[firstDate]!;

    // Create fee report
    const feeReport: FeeReport = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_NOVA,
      },
      distributors: {
        [firstDistributorAddress]: [
          {
            date: firstDate,
            start_balance_wei: firstBalance.balance_wei,
            end_balance_wei: firstBalance.balance_wei,
            balance_change_wei: FIRST_DAY_BALANCE_CHANGE,
            distributions_wei: NO_DISTRIBUTIONS,
            distributions_count: NO_DISTRIBUTIONS_COUNT,
            total_wei: FIRST_DAY_BALANCE_CHANGE, // balance_change + distributions = 0 + 0
          },
        ],
      },
    };

    // Write the report
    this.fileManager.writeFeeReport(feeReport);
  }
}
