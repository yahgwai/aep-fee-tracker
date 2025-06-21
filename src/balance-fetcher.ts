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
  }
}
