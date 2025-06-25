import {
  FileManager,
  FeeReport,
  RecipientRecievedEventData,
  FeeCalculatorError,
} from "./types";

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

export class FeeCalculator {
  constructor(public readonly fileManager: FileManager) {}

  calculateFees(distributorAddress?: string): void {
    // Read distributor list
    const distributorsData = this.fileManager.readDistributors();
    if (!distributorsData) {
      throw new FeeCalculatorError(
        "Failed to load distributor data\n  FileManager returned no distributor list\n  Check: Ensure distributor data has been populated by the distributor detector component",
        "calculateFees",
        { missingData: "distributors" },
      );
    }

    // Get all distributor addresses
    let distributorAddresses = Object.keys(distributorsData.distributors);

    // Check if distributor address is provided
    if (distributorAddress) {
      if (distributorAddresses.length === 0) {
        throw new FeeCalculatorError(
          `No distributors found in data while searching for ${distributorAddress}`,
          "calculateFees",
          {
            distributor: distributorAddress,
            missingData: "empty distributors list",
          },
        );
      }
      if (!distributorsData.distributors[distributorAddress]) {
        throw new FeeCalculatorError(
          `Distributor address ${distributorAddress} not found in distributor data`,
          "calculateFees",
          {
            distributor: distributorAddress,
            missingData: "distributor not in list",
          },
        );
      }
      distributorAddresses = [distributorAddress];
    } else if (distributorAddresses.length === 0) {
      // No distributor specified and no distributors exist - just return
      return;
    }

    // Initialize the fee report structure
    const feeReport: FeeReport = {
      metadata: {
        chain_id: distributorsData.metadata.chain_id,
      },
      distributors: {},
    };

    // Process each distributor
    for (const distributorAddress of distributorAddresses) {
      const dailyEntries = this.processDistributor(
        distributorAddress,
        distributorAddresses.length === 1,
      );
      if (dailyEntries) {
        feeReport.distributors[distributorAddress] = dailyEntries;
      }
    }

    // Only write the report if we have data for at least one distributor
    if (Object.keys(feeReport.distributors).length > 0) {
      this.fileManager.writeFeeReport(feeReport);
    }
  }

  private processDistributor(
    distributorAddress: string,
    isSpecificDistributor: boolean,
  ): FeeReportEntry[] | null {
    // Read balance data for the distributor
    const balanceData =
      this.fileManager.readDistributorBalances(distributorAddress);
    if (!balanceData) {
      if (isSpecificDistributor) {
        throw new FeeCalculatorError(
          `Failed to load balance data for distributor\n  Distributor: ${distributorAddress}\n  FileManager returned no balance data\n  Check: Ensure balance fetcher has processed this distributor`,
          "processDistributor",
          { distributor: distributorAddress, missingData: "balance data" },
        );
      }
      return null;
    }

    // Get all dates from balance data and sort chronologically
    const sortedDates = Object.keys(balanceData.balances).sort();
    if (sortedDates.length === 0) return null;

    // Read distribution events for the distributor
    const eventsData =
      this.fileManager.readRecipientRecievedEvents(distributorAddress);

    // Process all dates to create daily entries
    return this.createDailyEntries(
      sortedDates,
      balanceData.balances,
      eventsData,
    );
  }

  private createDailyEntries(
    sortedDates: string[],
    balances: { [date: string]: { block_number: number; balance_wei: string } },
    eventsData: RecipientRecievedEventData | undefined,
  ): FeeReportEntry[] {
    const dailyEntries: FeeReportEntry[] = [];
    let previousBalanceWei: string = "0"; // Start with 0 as previous balance
    let previousEndBlock: number = 0; // Track previous day's end block

    for (const date of sortedDates) {
      const currentBalance = balances[date]!;
      const balanceChangeWei = this.calculateBalanceChange(
        currentBalance.balance_wei,
        previousBalanceWei,
      );

      // Calculate distributions for this date
      const { distributionsWei, distributionsCount } =
        this.calculateDistributionsForDate(
          previousEndBlock + 1, // Start from block after previous day
          balances[date]!.block_number, // End at this day's block
          eventsData,
        );

      dailyEntries.push(
        this.createDailyEntry(
          date,
          currentBalance.balance_wei,
          balanceChangeWei,
          distributionsWei,
          distributionsCount,
        ),
      );
      previousBalanceWei = currentBalance.balance_wei;
      previousEndBlock = balances[date]!.block_number;
    }

    return dailyEntries;
  }

  private calculateBalanceChange(
    currentBalanceWei: string,
    previousBalanceWei: string,
  ): bigint {
    const currentBigInt = BigInt(currentBalanceWei);
    const previousBigInt = BigInt(previousBalanceWei);
    return currentBigInt - previousBigInt;
  }

  private createDailyEntry(
    date: string,
    balanceWei: string,
    balanceChangeWei: bigint,
    distributionsWei: bigint,
    distributionsCount: number,
  ): FeeReportEntry {
    // Calculate total_wei as sum of balance change and distributions
    const totalWei = balanceChangeWei + distributionsWei;

    return {
      date,
      start_balance_wei: balanceWei,
      end_balance_wei: balanceWei,
      balance_change_wei: balanceChangeWei.toString(),
      distributions_wei: distributionsWei.toString(),
      distributions_count: distributionsCount,
      total_wei: totalWei.toString(),
    };
  }

  private calculateDistributionsForDate(
    startBlockNumber: number,
    endBlockNumber: number,
    eventsData: RecipientRecievedEventData | undefined,
  ): { distributionsWei: bigint; distributionsCount: number } {
    // If no events data, return zeros
    if (!eventsData || !eventsData.events) {
      return {
        distributionsWei: BigInt(0),
        distributionsCount: 0,
      };
    }

    // Count events within the block range for this date
    let totalDistributions = BigInt(0);
    let count = 0;

    for (const event of Object.values(eventsData.events)) {
      // Check if event is within this date's block range
      if (
        event.blockNumber >= startBlockNumber &&
        event.blockNumber <= endBlockNumber
      ) {
        totalDistributions += BigInt(event.value);
        count++;
      }
    }

    return {
      distributionsWei: totalDistributions,
      distributionsCount: count,
    };
  }
}
