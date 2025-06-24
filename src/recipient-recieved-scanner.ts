import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorsData } from "./types";

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

    // Process distributors based on filter
    const distributorsToProcess = this.getDistributorsToProcess(
      distributorsData,
      distributorAddress,
    );

    // Log which distributors will be scanned
    this.logScanningInfo(distributorsToProcess, distributorAddress);
  }

  /**
   * Gets the distributors to process based on the filter parameter.
   * @private
   */
  private getDistributorsToProcess(
    distributorsData: DistributorsData,
    distributorAddress?: string,
  ): DistributorsData["distributors"] {
    if (distributorAddress) {
      // Find distributor with case-insensitive comparison
      const foundAddress = Object.keys(distributorsData.distributors).find(
        (address) => address.toLowerCase() === distributorAddress.toLowerCase(),
      );

      if (!foundAddress) {
        throw new Error(`Distributor ${distributorAddress} not found`);
      }

      // Return only the requested distributor
      const distributor = distributorsData.distributors[foundAddress];
      if (!distributor) {
        // This should never happen as we just found the address
        throw new Error(`Distributor ${distributorAddress} not found`);
      }
      return {
        [foundAddress]: distributor,
      };
    }

    // Return all distributors
    return distributorsData.distributors;
  }

  /**
   * Logs information about which distributors will be scanned.
   * @private
   */
  private logScanningInfo(
    distributorsToProcess: DistributorsData["distributors"],
    distributorAddress?: string,
  ): void {
    if (distributorAddress) {
      console.log(`Scanning distributor: ${distributorAddress}`);
    } else {
      const distributorCount = Object.keys(distributorsToProcess).length;
      console.log(`Scanning all ${distributorCount} distributors`);
    }
  }
}
