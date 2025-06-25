import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorsData, BlockNumberData, DistributorInfo } from "./types";

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
  protected async processDistributors(
    distributorAddress?: string,
  ): Promise<void> {
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

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.formatDate(yesterday);

    // Determine which distributors to process
    const distributorsToProcess = distributorAddress
      ? {
          [distributorAddress]:
            distributorsData.distributors[distributorAddress],
        }
      : distributorsData.distributors;

    // Process each distributor
    for (const [address, distributorInfo] of Object.entries(
      distributorsToProcess,
    )) {
      if (!distributorInfo) continue;

      await this.processDistributor(
        address,
        distributorInfo,
        blockNumbersData,
        yesterdayStr,
      );
    }
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
      throw new Error(`Distributor not found: ${distributorAddress}`);
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
   * Determines the start date for processing a distributor.
   * Can be overridden by subclasses to implement incremental processing.
   *
   * @param distributorInfo - The distributor information
   * @param distributorAddress - The distributor address
   * @returns The start date for processing (YYYY-MM-DD format) or null to skip
   */
  protected determineStartDate(
    distributorInfo: DistributorInfo,
    _distributorAddress: string,
  ): string | null {
    // Default implementation: start from creation date
    return distributorInfo.date;
  }

  /**
   * Determines which dates should be processed for a distributor.
   * Can be overridden by subclasses to implement custom filtering.
   *
   * @param distributorInfo - The distributor information
   * @param distributorAddress - The distributor address
   * @param blockNumbersData - Block numbers data for date validation
   * @param startDate - The start date determined by determineStartDate
   * @param endDate - The end date (usually yesterday)
   * @returns Array of dates to process (YYYY-MM-DD format)
   */
  protected getDatesToProcess(
    _distributorInfo: DistributorInfo,
    _distributorAddress: string,
    blockNumbersData: BlockNumberData,
    startDate: string,
    endDate: string,
  ): string[] {
    // Default implementation: process all dates from start to end that have block numbers
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = this.formatDate(currentDate);
      if (dateStr in blockNumbersData.blocks) {
        dates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  /**
   * Processes a distributor day by day from start date to yesterday.
   * @private
   */
  private async processDistributor(
    address: string,
    distributorInfo: DistributorInfo,
    blockNumbersData: BlockNumberData,
    yesterdayStr: string,
  ): Promise<void> {
    // Check if distributor is created in the future
    if (distributorInfo.date > yesterdayStr) {
      return;
    }

    // Determine start date using the overridable method
    const startDate = this.determineStartDate(distributorInfo, address);
    if (!startDate) {
      // Subclass indicated to skip this distributor
      return;
    }

    // Skip if start date is after yesterday (all dates processed)
    if (startDate > yesterdayStr) {
      return;
    }

    // Get the dates to process
    const datesToProcess = this.getDatesToProcess(
      distributorInfo,
      address,
      blockNumbersData,
      startDate,
      yesterdayStr,
    );

    // Early return if no dates to process
    if (datesToProcess.length === 0) {
      return;
    }

    // Accumulate results from processDailyData
    const results: T[] = [];
    let lastProcessedBlock = 0;

    // Process each date
    for (const dateStr of datesToProcess) {
      // Calculate block range for this day
      const { startBlock, endBlock } = this.convertDateToBlockRange(
        dateStr,
        blockNumbersData,
      );

      // Process this day's data
      const dailyResult = await this.processDailyData(
        address,
        dateStr,
        startBlock,
        endBlock,
      );

      // Accumulate result
      results.push(dailyResult);

      // Track the last processed block
      lastProcessedBlock = endBlock;
    }

    // Finalize and store all accumulated data
    if (results.length > 0 || lastProcessedBlock > 0) {
      await this.finalizeDistributorData(address, results, lastProcessedBlock);
    }
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
