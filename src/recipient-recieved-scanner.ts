import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorsData, BlockNumberData, DistributorInfo } from "./types";

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

    // Validate distributor exists if specified
    if (distributorAddress) {
      this.validateDistributorExists(distributorsData, distributorAddress);
    }

    // Load block numbers data to determine date ranges
    const blockNumbersData = this.fileManager.readBlockNumbers();
    if (!blockNumbersData) {
      return;
    }

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.formatDate(yesterday);

    // Process distributors
    const distributorsToProcess = distributorAddress
      ? {
          [distributorAddress]:
            distributorsData.distributors[distributorAddress],
        }
      : distributorsData.distributors;

    for (const [address, distributorInfo] of Object.entries(
      distributorsToProcess,
    )) {
      if (!distributorInfo) continue;

      const datesToProcess = this.determineDateRangeForDistributor(
        address,
        distributorInfo,
        blockNumbersData,
        yesterdayStr,
      );

      if (datesToProcess.length === 0) {
        continue;
      }

      // Convert dates to block ranges and validate block numbers
      const blockRanges = this.convertDatesToBlockRanges(
        datesToProcess,
        blockNumbersData,
        address,
      );

      // TODO: Process the block ranges (out of scope for this issue)
      void blockRanges; // Suppress unused variable warning
    }
  }

  /**
   * Validates that the specified distributor exists in the data.
   * @private
   */
  private validateDistributorExists(
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
   * @private
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Finds the date for a given block number.
   * @private
   */
  private findDateForBlock(
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
   * Determines the date range to process for a distributor.
   * @private
   */
  private determineDateRangeForDistributor(
    address: string,
    distributorInfo: DistributorInfo,
    blockNumbersData: BlockNumberData,
    yesterdayStr: string,
  ): string[] {
    // Check if distributor is created in the future
    if (distributorInfo.date > yesterdayStr) {
      return [];
    }

    // Load existing event data
    const existingEventData =
      this.fileManager.readRecipientRecievedEvents(address);

    // Determine start date
    let startDate: string;
    if (existingEventData && existingEventData.metadata.last_scanned_block) {
      // Find the date of the last scanned block
      const lastScannedBlock = existingEventData.metadata.last_scanned_block;
      const lastScannedDate = this.findDateForBlock(
        blockNumbersData,
        lastScannedBlock,
      );
      if (!lastScannedDate) {
        throw new Error(
          `Cannot find date for block ${lastScannedBlock} for distributor ${address}`,
        );
      }
      // Start from day after last scanned date
      const nextDay = new Date(lastScannedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      startDate = this.formatDate(nextDay);
    } else {
      // No existing data, start from creation date
      startDate = distributorInfo.date;
    }

    // Skip if start date is after yesterday (all dates processed)
    if (startDate > yesterdayStr) {
      return [];
    }

    // Determine date range to process
    return this.getDateRange(startDate, yesterdayStr);
  }

  /**
   * Gets an array of dates between start and end (inclusive).
   * @private
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Converts dates to block ranges with validation.
   * @private
   */
  private convertDatesToBlockRanges(
    dates: string[],
    blockNumbersData: BlockNumberData,
    distributorAddress: string,
  ): Array<{ date: string; startBlock: number; endBlock: number }> {
    // First validate all dates have block numbers
    this.validateBlockNumbersForDates(
      dates,
      blockNumbersData,
      distributorAddress,
    );

    // Then convert each date to a block range
    return dates.map((date) => {
      const { startBlock, endBlock } = this.convertDateToBlockRange(
        date,
        blockNumbersData,
      );
      return { date, startBlock, endBlock };
    });
  }

  /**
   * Validates that block numbers exist for all dates in the range.
   * @private
   */
  private validateBlockNumbersForDates(
    dates: string[],
    blockNumbersData: BlockNumberData,
    distributorAddress: string,
  ): void {
    for (const date of dates) {
      if (!(date in blockNumbersData.blocks)) {
        throw new Error(
          `Missing block number for date ${date} for distributor ${distributorAddress}`,
        );
      }
    }
  }

  /**
   * Converts a date to a block range (start and end blocks).
   * @private
   */
  private convertDateToBlockRange(
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
}
