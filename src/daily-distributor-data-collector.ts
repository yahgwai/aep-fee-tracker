import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorsData, BlockNumberData } from "./types";

/**
 * Abstract base class for collectors that process distributor data on a daily basis.
 * Provides common functionality for loading distributors, validating addresses,
 * and iterating through date ranges.
 *
 * @template T The type of data returned by processDailyData
 */
export abstract class DailyDistributorDataCollector<T = unknown> {
  constructor(
    public readonly provider: ethers.Provider,
    public readonly fileManager: FileManager,
  ) {}

  /**
   * Main entry point for processing distributors.
   * Validates input, loads data, and orchestrates the daily processing.
   *
   * @param distributorAddress - Optional specific distributor to process
   * @returns Promise that resolves when processing is complete
   */
  async processDistributors(distributorAddress?: string): Promise<void> {
    // Validate address if provided
    if (
      distributorAddress !== undefined &&
      !ethers.isAddress(distributorAddress)
    ) {
      throw new Error(`Invalid Ethereum address: ${distributorAddress}`);
    }

    // Load distributors data
    const distributorsData = this.fileManager.readDistributors();

    // Early return if no distributors data
    if (
      !distributorsData ||
      Object.keys(distributorsData.distributors).length === 0
    ) {
      return;
    }

    // Validate distributor exists if specified
    if (distributorAddress) {
      this.validateDistributorExists(distributorsData, distributorAddress);
    }

    // Load block numbers data
    const blockNumbersData = this.fileManager.readBlockNumbers();
    if (!blockNumbersData) {
      return;
    }

    // Process will be implemented in subsequent steps
  }

  /**
   * Validates that the specified distributor exists in the data.
   * Uses case-insensitive comparison to handle checksum mismatches.
   *
   * @param distributorsData - The distributors data to search in
   * @param distributorAddress - The distributor address to validate
   * @throws Error if distributor not found
   */
  protected validateDistributorExists(
    distributorsData: DistributorsData,
    distributorAddress: string,
  ): void {
    // Find distributor with case-insensitive comparison
    const foundAddress = Object.keys(distributorsData.distributors).find(
      (address) => address.toLowerCase() === distributorAddress.toLowerCase(),
    );

    if (!foundAddress) {
      throw new Error(`Distributor ${distributorAddress} not found`);
    }
  }

  /**
   * Formats a Date object to YYYY-MM-DD string.
   * @protected - Available to subclasses
   */
  protected formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Finds the date for a given block number.
   * @protected - Available to subclasses
   */
  protected findDateForBlock(
    blockNumbersData: BlockNumberData,
    blockNumber: number,
  ): string | null {
    // Find the date where the block number is less than or equal to the end-of-day block
    for (const [date, block] of Object.entries(blockNumbersData.blocks)) {
      if (blockNumber <= (block as number)) {
        return date;
      }
    }
    return null;
  }

  /**
   * Converts a date to a block range (start and end blocks).
   * @protected - Available to subclasses
   */
  protected convertDateToBlockRange(
    date: string,
    blockNumbersData: BlockNumberData,
  ): { startBlock: number; endBlock: number } {
    const endBlock = blockNumbersData.blocks[date];
    if (endBlock === undefined) {
      throw new Error(`Block number not found for date ${date}`);
    }

    // Calculate start block from previous day's end block
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = this.formatDate(previousDate);

    const previousBlock = blockNumbersData.blocks[previousDateStr];
    const startBlock = previousBlock !== undefined ? previousBlock + 1 : 1;

    return { startBlock, endBlock };
  }

  /**
   * Process data for a specific distributor on a specific date.
   * To be implemented by subclasses for their specific data collection needs.
   *
   * @param distributorAddress - The distributor being processed
   * @param date - The date being processed (YYYY-MM-DD format)
   * @param startBlock - The starting block number for this date
   * @param endBlock - The ending block number for this date
   * @returns Promise resolving to collected data for this date
   */
  abstract processDailyData(
    distributorAddress: string,
    date: string,
    startBlock: number,
    endBlock: number,
  ): Promise<T>;

  /**
   * Finalize and store the collected data for a distributor.
   * To be implemented by subclasses to handle their specific storage needs.
   *
   * @param distributorAddress - The distributor that was processed
   * @param results - Array of daily results from processDailyData
   * @param lastProcessedBlock - The last block that was processed
   * @returns Promise that resolves when data is stored
   */
  abstract finalizeDistributorData(
    distributorAddress: string,
    results: T[],
    lastProcessedBlock: number,
  ): Promise<void>;
}
