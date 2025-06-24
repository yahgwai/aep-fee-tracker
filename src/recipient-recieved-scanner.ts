import { ethers } from "ethers";
import { FileManager } from "./file-manager";

/**
 * Creates a new RecipientRecievedScanner instance with the specified dependencies.
 *
 * @param provider - Ethereum provider for RPC calls
 * @param fileManager - File manager instance for data persistence
 */
export class RecipientRecievedScanner {
  constructor(
    public readonly provider: ethers.Provider,
    public readonly fileManager: FileManager,
  ) {}

  /**
   * Scans for RecipientRecieved events and updates outflow data.
   * Currently implements only address validation. Full implementation pending issue #173 and #174.
   *
   * @param distributorAddress - Optional distributor address. If provided, scans only that distributor. If omitted, scans all distributors
   * @returns Promise that resolves when scanning is complete
   * @throws Error if invalid Ethereum address provided
   */
  async scan(distributorAddress?: string): Promise<void> {
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
      return;
    }

    // If specific distributor requested, validate it exists
    if (distributorAddress) {
      // Find distributor with case-insensitive comparison
      const foundDistributor = Object.keys(distributorsData.distributors).find(
        (address) => address.toLowerCase() === distributorAddress.toLowerCase(),
      );

      if (!foundDistributor) {
        throw new Error(`Distributor ${distributorAddress} not found`);
      }

      console.log(`Scanning distributor: ${distributorAddress}`);
    } else {
      // Process all distributors
      const distributorCount = Object.keys(
        distributorsData.distributors,
      ).length;
      console.log(`Scanning all ${distributorCount} distributors`);
    }
  }
}
