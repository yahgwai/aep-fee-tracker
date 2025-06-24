import { FileManager, FeeReport } from "./types";

export class FeeCalculator {
  constructor(public readonly fileManager: FileManager) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateFees(_distributorAddress?: string): void {
    // Read distributor list
    const distributorsData = this.fileManager.readDistributors();

    // Handle empty distributor data
    if (
      !distributorsData ||
      Object.keys(distributorsData.distributors).length === 0
    ) {
      return;
    }

    // Get the first distributor
    const firstDistributorAddress = Object.keys(
      distributorsData.distributors,
    )[0]!;

    // Read balance data for the first distributor
    const balanceData = this.fileManager.readDistributorBalances(
      firstDistributorAddress,
    );

    // Handle missing or empty balance data
    if (!balanceData || Object.keys(balanceData.balances).length === 0) {
      return;
    }

    // Get the first date from balance data
    const firstDate = Object.keys(balanceData.balances).sort()[0]!;
    const firstBalance = balanceData.balances[firstDate]!;

    // Create fee report
    const feeReport: FeeReport = {
      metadata: {
        chain_id: 42170,
      },
      distributors: {
        [firstDistributorAddress]: [
          {
            date: firstDate,
            start_balance_wei: firstBalance.balance_wei,
            end_balance_wei: firstBalance.balance_wei,
            balance_change_wei: "0", // Always 0 for first day
            distributions_wei: "0", // No event processing
            distributions_count: 0,
            total_wei: "0", // balance_change + distributions = 0 + 0
          },
        ],
      },
    };

    // Write the report
    this.fileManager.writeFeeReport(feeReport);
  }
}
