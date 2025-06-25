import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DailyDistributorDataCollector } from "./daily-distributor-data-collector";
import {
  withRetry,
  BalanceData,
  DistributorInfo,
  BlockNumberData,
} from "./types";

// Retry configuration for RPC calls
const RPC_RETRY_CONFIG = {
  maxRetries: 3,
} as const;

/**
 * Creates a new BalanceFetcher instance with the specified dependencies.
 *
 * @param fileManager - File manager instance for data persistence
 * @param provider - Nova provider for RPC calls
 */
export class BalanceFetcher extends DailyDistributorDataCollector<{
  address: string;
  date: string;
  block: number;
}> {
  // Track collected balances for the return value
  private collectedBalances: Record<string, Record<string, string>> = {};

  constructor(fileManager: FileManager, provider: ethers.Provider) {
    // Call base class constructor with provider and fileManager in the expected order
    super(provider, fileManager);
  }

  // Override to only process dates that don't have existing balances
  protected override getDatesToProcess(
    distributorInfo: DistributorInfo,
    distributorAddress: string,
    blockNumbersData: BlockNumberData,
    startDate: string,
    endDate: string,
  ): string[] {
    // Load existing balance data
    const existingData =
      this.fileManager.readDistributorBalances(distributorAddress);

    // Get all available dates from block numbers
    const availableDates = Object.entries(blockNumbersData.blocks)
      .filter(([date]) => date >= startDate && date <= endDate)
      .map(([date]) => date);

    // Special handling for creation date
    const creationDate = distributorInfo.date;
    const creationDateHasEndOfDayBlock = availableDates.includes(creationDate);

    // Filter out dates that already have balances
    const datesToProcess = availableDates.filter(
      (date) => !existingData?.balances[date],
    );

    // Add creation date if it doesn't have an end-of-day block and doesn't have balance
    if (
      !creationDateHasEndOfDayBlock &&
      creationDate >= startDate &&
      creationDate <= endDate &&
      !existingData?.balances[creationDate]
    ) {
      datesToProcess.push(creationDate);
    }

    // Sort chronologically
    return datesToProcess.sort();
  }

  // Override to handle creation blocks specially
  protected override convertDateToBlockRange(
    date: string,
    blockNumbersData: BlockNumberData,
  ): { startBlock: number; endBlock: number } {
    // Check if this date has an end-of-day block
    if (date in blockNumbersData.blocks) {
      return super.convertDateToBlockRange(date, blockNumbersData);
    }

    // For dates without end-of-day blocks (like creation dates),
    // return a special marker that processDailyData will handle
    return { startBlock: 0, endBlock: 0 };
  }

  // Implement abstract methods
  async processDailyData(
    distributorAddress: string,
    date: string,
    _startBlock: number,
    endBlock: number,
  ): Promise<{ address: string; date: string; block: number }> {
    // For BalanceFetcher, we only need the end-of-day block
    // Special case: if block is 0, this is a creation date without end-of-day block
    if (endBlock === 0) {
      const distributorsData = this.fileManager.readDistributors();
      const distributorInfo =
        distributorsData?.distributors[distributorAddress];

      if (distributorInfo && date === distributorInfo.date) {
        // Use creation block for creation date
        return {
          address: distributorAddress,
          date,
          block: distributorInfo.block,
        };
      }
    }

    return { address: distributorAddress, date, block: endBlock };
  }

  async finalizeDistributorData(
    distributorAddress: string,
    results: Array<{ address: string; date: string; block: number }>,
    _lastProcessedBlock: number,
  ): Promise<void> {
    // Filter out skipped dates (where block is -1)
    const validResults = results.filter((r) => r.block !== -1);

    if (validResults.length === 0) {
      return;
    }

    // Fetch balances for all the collected dates
    const newBalances: Record<string, string> = {};

    for (const { date, block } of validResults) {
      const balance = await withRetry(
        () => this.provider.getBalance(distributorAddress, block),
        {
          ...RPC_RETRY_CONFIG,
          operationName: `getBalance(${distributorAddress}, ${block})`,
        },
      );
      newBalances[date] = balance.toString();
    }

    // Track collected balances for return value
    if (!this.collectedBalances[distributorAddress]) {
      this.collectedBalances[distributorAddress] = {};
    }
    Object.assign(this.collectedBalances[distributorAddress], newBalances);

    // Get existing balance data
    const existingData =
      this.fileManager.readDistributorBalances(distributorAddress);

    // Get chain ID
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Create and save balance data
    const balanceData = this.createBalanceData(
      distributorAddress,
      existingData,
      newBalances,
      validResults,
      chainId,
    );

    this.fileManager.writeDistributorBalances(distributorAddress, balanceData);
  }

  /**
   * Creates balance data structure for a distributor with metadata and balances.
   * @private
   */
  private createBalanceData(
    address: string,
    existingData: BalanceData | undefined,
    newBalances: Record<string, string>,
    allFetches: Array<{ address: string; date: string; block: number }>,
    chainId: number,
  ): BalanceData {
    const balanceData: BalanceData = {
      metadata: {
        chain_id: existingData?.metadata.chain_id || chainId,
        reward_distributor: address,
      },
      balances: {
        // Merge existing balances (if any)
        ...(existingData?.balances || {}),
      },
    };

    // Add new balances with block numbers
    for (const [date, balanceWei] of Object.entries(newBalances)) {
      const blockNumber = allFetches.find(
        (f) => f.address === address && f.date === date,
      )!.block;

      balanceData.balances[date] = {
        block_number: blockNumber,
        balance_wei: balanceWei,
      };
    }

    return balanceData;
  }

  /**
   * Fetches missing balances for all distributors or a specific distributor.
   * Uses incremental processing to only fetch balances for dates that haven't been fetched yet.
   *
   * @param distributorAddress - If provided, only fetch balances for this specific distributor
   * @returns Promise that resolves with collected decimal string balances by distributor and date, or empty record if no new balances to fetch
   * @throws Error on any failure
   */
  async fetchBalances(
    distributorAddress?: string,
  ): Promise<Record<string, Record<string, string>>> {
    // Reset collected balances for this run
    this.collectedBalances = {};

    // Use the base class processDistributors method
    await this.processDistributors(distributorAddress);

    // Return the collected balances
    return this.collectedBalances;
  }
}
