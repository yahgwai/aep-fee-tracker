import { ethers } from "ethers";
import { FileManager } from "../../infrastructure/storage/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  DistributorInfo,
  RecipientRecievedEventData,
} from "../../types";
import { withRetry, RetryOptions } from "../../utils/retry";
import { chunkBlockRange } from "../block-processing/block-range-chunking";
import { logger } from "../../utils/logger";

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
 * @param retryConfig - Optional retry configuration for RPC calls
 */
export class RecipientRecievedScanner {
  private readonly retryConfig: Partial<RetryOptions>;

  constructor(
    public readonly provider: ethers.Provider,
    public readonly fileManager: FileManager,
    retryConfig?: Partial<RetryOptions>,
  ) {
    this.retryConfig = retryConfig || {};
  }

  /**
   * Queries RecipientRecieved events for a distributor within a block range.
   * Chunks large block ranges and applies retry logic to RPC calls.
   *
   * @param distributorAddress - The distributor contract address
   * @param fromBlock - Starting block number (inclusive)
   * @param toBlock - Ending block number (inclusive)
   * @returns Promise resolving to array of raw event logs
   */
  async queryRecipientRecievedEvents(
    distributorAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<ethers.Log[]> {
    const allLogs: ethers.Log[] = [];
    const chunks = chunkBlockRange(fromBlock, toBlock, 10000);

    // Process each chunk
    for (const chunk of chunks) {
      const filter = {
        address: distributorAddress,
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: chunk.fromBlock,
        toBlock: chunk.toBlock,
      };

      // Query events with retry logic
      const logs = await withRetry(() => this.provider.getLogs(filter), {
        maxRetries: 3,
        operationName: `queryRecipientRecievedEvents.getLogs(${chunk.fromBlock}-${chunk.toBlock})`,
        ...this.retryConfig,
      });

      allLogs.push(...logs);
    }

    return allLogs;
  }

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

    // Get max date from block numbers store using FileManager
    const maxDate = this.fileManager.getMaxDate();
    if (!maxDate) {
      return;
    }
    const maxDateInStore = this.formatDate(maxDate);

    // Process distributors
    const distributorsToProcess = distributorAddress
      ? {
          [distributorAddress]:
            distributorsData.distributors[distributorAddress],
        }
      : distributorsData.distributors;

    const distributorEntries = Object.entries(distributorsToProcess);

    // Count only reward distributors for accurate progress tracking
    const rewardDistributors = distributorEntries.filter(
      ([, infoArray]) => infoArray && infoArray[0]?.is_reward_distributor,
    );
    let rewardDistributorIndex = 0;

    // Process distributors
    for (const [address, distributorInfoArray] of distributorEntries) {
      if (!distributorInfoArray || distributorInfoArray.length === 0) continue;

      const distributorInfo = distributorInfoArray[0];

      if (!distributorInfo) {
        throw new Error(
          `Invalid distributor data for ${address}: array contains falsy element`,
        );
      }

      if (!distributorInfo.is_reward_distributor) {
        logger.log(`Skipping distributor ${address}: not a reward distributor`);
        continue;
      }

      rewardDistributorIndex++;
      logger.log(
        `Scanning events for distributor ${rewardDistributorIndex}/${rewardDistributors.length}: ${address}`,
      );

      await this.processDistributor(
        address,
        distributorInfo,
        blockNumbersData,
        maxDateInStore,
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
   * Processes a distributor day by day from last scanned date to max date in store.
   * @private
   */
  private async processDistributor(
    address: string,
    distributorInfo: DistributorInfo,
    blockNumbersData: BlockNumberData,
    maxDateInStore: string,
  ): Promise<void> {
    // Check if distributor is created after the max date in store
    if (distributorInfo.date > maxDateInStore) {
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

    // Skip if start date is after max date in store (all dates processed)
    if (startDate > maxDateInStore) {
      return;
    }

    logger.log(`Scanning date range: ${startDate} to ${maxDateInStore}`);

    // Get chain ID from distributors data
    const distributorsData = this.fileManager.readDistributors();
    const chainId = distributorsData?.metadata.chain_id || 0;

    // Accumulate all events
    const allEvents: ethers.Log[] = [];

    // Process one day at a time
    const currentDate = new Date(startDate);
    const endDate = new Date(maxDateInStore);
    let lastProcessedBlock = 0;

    while (currentDate <= endDate) {
      const dateStr = this.formatDate(currentDate);

      // Check if block number exists for this date
      if (!(dateStr in blockNumbersData.blocks)) {
        // Skip dates that don't exist in the block store
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Calculate block range for this day
      const { startBlock, endBlock } = this.convertDateToBlockRange(
        dateStr,
        blockNumbersData,
      );

      // Query RecipientRecieved events for this block range
      const events = await this.queryRecipientRecievedEvents(
        address,
        startBlock,
        endBlock,
      );

      // Accumulate events
      if (events.length > 0) {
        allEvents.push(...events);
      }

      // Track the last processed block
      lastProcessedBlock = endBlock;

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Parse and store all accumulated events at once
    if (allEvents.length > 0 || lastProcessedBlock > 0) {
      logger.log(`Found ${allEvents.length} events for distributor ${address}`);
      this.parseAndStoreEvents(
        address,
        allEvents,
        chainId,
        lastProcessedBlock,
        existingEventData,
      );
    }
  }

  /**
   * Finds the most recent block number before the given date.
   * @private
   */
  private findPreviousBlockNumber(
    date: string,
    blockNumbersData: BlockNumberData,
  ): number | null {
    const sortedDates = Object.keys(blockNumbersData.blocks).sort();
    const currentDateIndex = sortedDates.indexOf(date);

    if (currentDateIndex <= 0) {
      return null;
    }

    const previousDate = sortedDates[currentDateIndex - 1];
    if (!previousDate) {
      return null;
    }

    return blockNumbersData.blocks[previousDate] || null;
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

    const previousBlock = this.findPreviousBlockNumber(date, blockNumbersData);
    const startBlock = previousBlock !== null ? previousBlock + 1 : 1;

    return { startBlock, endBlock };
  }

  /**
   * Parses events and stores them using FileManager.
   * @private
   */
  private parseAndStoreEvents(
    distributorAddress: string,
    events: ethers.Log[],
    chainId: number,
    lastProcessedBlock: number,
    existingData: RecipientRecievedEventData | undefined,
  ): void {
    // Initialize event data structure
    const eventData: RecipientRecievedEventData = {
      metadata: {
        chain_id: chainId,
        reward_distributor: distributorAddress,
        last_scanned_block: lastProcessedBlock,
      },
      events: existingData?.events || {},
    };

    // Parse each event
    for (const log of events) {
      const parsedLog = recipientRecievedInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsedLog) {
        // Create unique key
        const eventKey = `${log.transactionHash}:${log.index}`;

        // Extract recipient and value from parsed event
        const recipient = ethers.getAddress(parsedLog.args["recipient"]);
        const value = parsedLog.args["value"].toString();

        // Store the event
        eventData.events[eventKey] = {
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.index,
          address: log.address,
          topics: log.topics as string[],
          data: log.data,
          recipient,
          value,
        };
      }
    }

    // Save the updated event data
    this.fileManager.writeRecipientRecievedEvents(
      distributorAddress,
      eventData,
    );
  }
}
