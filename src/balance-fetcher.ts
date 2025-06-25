import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DailyDistributorDataCollector } from "./daily-distributor-data-collector";
import { withRetry, BalanceData } from "./types";

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
  constructor(fileManager: FileManager, provider: ethers.Provider) {
    // Call base class constructor with provider and fileManager in the expected order
    super(provider, fileManager);
  }

  // Implement abstract methods
  async processDailyData(
    distributorAddress: string,
    date: string,
    _startBlock: number,
    endBlock: number,
  ): Promise<{ address: string; date: string; block: number }> {
    // For BalanceFetcher, we only need the end-of-day block
    return { address: distributorAddress, date, block: endBlock };
  }

  async finalizeDistributorData(
    distributorAddress: string,
    results: Array<{ address: string; date: string; block: number }>,
    _lastProcessedBlock: number,
  ): Promise<void> {
    if (results.length === 0) {
      return;
    }

    // Fetch balances for all the collected dates
    const collectedBalances: Record<string, string> = {};

    for (const { date, block } of results) {
      const balance = await withRetry(
        () => this.provider.getBalance(distributorAddress, block),
        {
          ...RPC_RETRY_CONFIG,
          operationName: `getBalance(${distributorAddress}, ${block})`,
        },
      );
      collectedBalances[date] = balance.toString();
    }

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
      collectedBalances,
      results,
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
    // Validate distributorAddress parameter if provided
    if (
      distributorAddress !== undefined &&
      !ethers.isAddress(distributorAddress)
    ) {
      throw new Error(`Invalid Ethereum address: ${distributorAddress}`);
    }
    const distributorsData = this.fileManager.readDistributors();

    // Early return if no distributors data
    if (
      !distributorsData ||
      Object.keys(distributorsData.distributors).length === 0
    ) {
      return {};
    }

    // If specific distributor requested, validate it exists
    if (distributorAddress) {
      // Check if the distributor exists in the data
      if (!distributorsData.distributors[distributorAddress]) {
        throw new Error(`Distributor not found: ${distributorAddress}`);
      }
    }

    // Load block numbers
    const blockNumbersData = this.fileManager.readBlockNumbers();
    if (!blockNumbersData) {
      return {};
    }

    // Process distributors
    const distributorsToProcess = distributorAddress
      ? {
          [distributorAddress]:
            distributorsData.distributors[distributorAddress],
        }
      : distributorsData.distributors;

    // Map to track existing balances per distributor for merging
    const existingBalancesByDistributor: Record<
      string,
      BalanceData | undefined
    > = {};

    // Collect all address/date/block combinations
    const allFetches: Array<{ address: string; date: string; block: number }> =
      [];

    for (const [address, distributorInfo] of Object.entries(
      distributorsToProcess,
    )) {
      if (!distributorInfo) continue;

      const creationDate = distributorInfo.date;
      const creationBlock = distributorInfo.block;

      // Load existing balance data for this distributor
      const existingBalances =
        this.fileManager.readDistributorBalances(address);
      existingBalancesByDistributor[address] = existingBalances;

      // Get all block numbers from creation date onward
      const endOfDayBlocks = Object.entries(blockNumbersData.blocks).filter(
        ([date]) => date >= creationDate,
      );

      // Skip future distributors (no applicable blocks to fetch)
      if (endOfDayBlocks.length === 0) {
        continue;
      }

      // Include creation block if its date doesn't have an end-of-day block
      const creationDateHasEndOfDayBlock = endOfDayBlocks.some(
        ([date]) => date === creationDate,
      );

      if (!creationDateHasEndOfDayBlock) {
        endOfDayBlocks.push([creationDate, creationBlock]);
      }

      // Collect all blocks for this distributor (incremental processing)
      for (const [date, block] of endOfDayBlocks) {
        // Only fetch if balance doesn't already exist
        if (!existingBalances?.balances[date]) {
          allFetches.push({ address, date, block });
        }
      }
    }

    // Sort all fetches chronologically by date
    allFetches.sort((a, b) => a.date.localeCompare(b.date));

    // Return empty record if no fetches needed
    if (allFetches.length === 0) {
      return {};
    }

    // Collect balances by distributor and date
    const collectedBalances: Record<string, Record<string, string>> = {};

    // Fetch balances in chronological order
    for (const { address, date, block } of allFetches) {
      const balance = await withRetry(
        () => this.provider.getBalance(address, block),
        {
          ...RPC_RETRY_CONFIG,
          operationName: `getBalance(${address}, ${block})`,
        },
      );

      // Store balance as decimal string
      if (!collectedBalances[address]) {
        collectedBalances[address] = {};
      }
      collectedBalances[address][date] = balance.toString();
    }

    // Get chain ID from provider for new balance data
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Save balance data for each distributor
    for (const [address, newBalances] of Object.entries(collectedBalances)) {
      const existingData = existingBalancesByDistributor[address];
      const balanceData = this.createBalanceData(
        address,
        existingData,
        newBalances,
        allFetches,
        chainId,
      );
      this.fileManager.writeDistributorBalances(address, balanceData);
    }

    return collectedBalances;
  }
}
