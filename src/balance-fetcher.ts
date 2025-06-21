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
   * Fetch balances for all distributors or a specific distributor at all tracked dates.
   *
   * @param distributorAddress - If provided, only fetch balances for this specific distributor
   * @returns Promise that resolves when all balances are fetched successfully
   * @throws Error on any failure
   */
  async fetchBalances(distributorAddress?: string): Promise<void> {
    void distributorAddress; // Satisfy linter
    throw new Error("Not implemented");
  }
}
