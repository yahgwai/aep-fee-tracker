import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorsData, BlockNumberData, DistributorInfo } from "./types";

// Event signature and topic for RecipientRecieved event
export const RECIPIENT_RECIEVED_EVENT_SIGNATURE =
  "RecipientRecieved(address,uint256)";
export const RECIPIENT_RECIEVED_EVENT_TOPIC = ethers.id(
  RECIPIENT_RECIEVED_EVENT_SIGNATURE,
);

// Event ABI definition
export const RECIPIENT_RECIEVED_EVENT_ABI = [
  "event RecipientRecieved(address indexed recipient, uint256 value)",
];

// Create ethers Interface for event parsing
export const recipientRecievedInterface = new ethers.Interface(
  RECIPIENT_RECIEVED_EVENT_ABI,
);

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

      // Process this distributor day by day
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
   * Processes a distributor day by day from last scanned date to yesterday.
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
      return;
    }

    // Process one day at a time
    const currentDate = new Date(startDate);
    const endDate = new Date(yesterdayStr);

    while (currentDate <= endDate) {
      const dateStr = this.formatDate(currentDate);

      // Check if block number exists for this date
      if (!(dateStr in blockNumbersData.blocks)) {
        throw new Error(
          `Missing block number for date ${dateStr} for distributor ${address}`,
        );
      }

      // Calculate block range for this day
      const { startBlock, endBlock } = this.convertDateToBlockRange(
        dateStr,
        blockNumbersData,
      );

      // TODO: Fetch and process receipts for this block range (out of scope for this issue)
      void { date: dateStr, startBlock, endBlock }; // Suppress unused variable warning

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
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
