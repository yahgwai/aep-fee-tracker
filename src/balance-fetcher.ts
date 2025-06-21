import { ethers } from "ethers";
import { FileManager } from "./file-manager";

/**
 * Creates a new BalanceFetcher instance with the specified dependencies.
 *
 * @param fileManager - File manager instance for data persistence
 * @param provider - Nova provider for RPC calls
 */
export class BalanceFetcher {
  constructor(
    public readonly fileManager: FileManager,
    public readonly provider: ethers.Provider,
  ) {}

  /**
   * Fetches missing balances for all distributors or a specific distributor.
   * Uses incremental processing to only fetch balances for dates that haven't been fetched yet.
   *
   * @param distributorAddress - If provided, only fetch balances for this specific distributor
   * @returns Promise that resolves when all missing balances are fetched successfully
   * @throws Error on any failure
   */
  async fetchBalances(distributorAddress?: string): Promise<void> {
    const distributorsData = this.fileManager.readDistributors();

    // Early return if no distributors data
    if (
      !distributorsData ||
      Object.keys(distributorsData.distributors).length === 0
    ) {
      return;
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
      return;
    }

    // Process distributors
    const distributorsToProcess = distributorAddress
      ? {
          [distributorAddress]:
            distributorsData.distributors[distributorAddress],
        }
      : distributorsData.distributors;

    // Collect all address/date/block combinations
    const allFetches: Array<{ address: string; date: string; block: number }> =
      [];

    for (const [address, distributorInfo] of Object.entries(
      distributorsToProcess,
    )) {
      if (!distributorInfo) continue;

      const creationDate = distributorInfo.date;
      const creationBlock = distributorInfo.block;

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

      // Collect all blocks for this distributor
      for (const [date, block] of endOfDayBlocks) {
        allFetches.push({ address, date, block });
      }
    }

    // Sort all fetches chronologically by date
    allFetches.sort((a, b) => a.date.localeCompare(b.date));

    // Fetch balances in chronological order
    for (const { address, block } of allFetches) {
      await this.provider.getBalance(address, block);
    }
  }
}
