import { ethers } from "ethers";
import { DailyDistributorDataCollector } from "./daily-distributor-data-collector";
import {
  DistributorInfo,
  RecipientRecievedEventData,
  withRetry,
  BlockNumberData,
} from "./types";
import { chunkBlockRange } from "./utils/block-range-chunking";

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
export class RecipientRecievedScanner extends DailyDistributorDataCollector<
  ethers.Log[]
> {
  // Override to implement incremental processing based on last scanned block
  protected override determineStartDate(
    distributorInfo: DistributorInfo,
    distributorAddress: string,
  ): string | null {
    // Load existing event data
    const existingEventData =
      this.fileManager.readRecipientRecievedEvents(distributorAddress);

    if (existingEventData && existingEventData.metadata.last_scanned_block) {
      // Find the date of the last scanned block
      const lastScannedBlock = existingEventData.metadata.last_scanned_block;
      const blockNumbersData = this.fileManager.readBlockNumbers();

      if (!blockNumbersData) {
        return null;
      }

      const lastScannedDate = this.findDateForBlock(
        blockNumbersData,
        lastScannedBlock,
      );

      if (!lastScannedDate) {
        throw new Error(
          `Cannot find date for block ${lastScannedBlock} for distributor ${distributorAddress}`,
        );
      }

      // Start from day after last scanned date
      const nextDay = new Date(lastScannedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return this.formatDate(nextDay);
    }

    // No existing data, start from creation date
    return distributorInfo.date;
  }

  // Override to throw error for missing blocks (required behavior for scanner)
  protected override getDatesToProcess(
    distributorInfo: DistributorInfo,
    distributorAddress: string,
    blockNumbersData: BlockNumberData,
    startDate: string,
    endDate: string,
  ): string[] {
    // Get dates from parent implementation
    const dates = super.getDatesToProcess(
      distributorInfo,
      distributorAddress,
      blockNumbersData,
      startDate,
      endDate,
    );

    // Additionally check that all dates in range have block numbers
    // This maintains the original behavior of throwing for missing blocks
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = this.formatDate(currentDate);
      if (!(dateStr in blockNumbersData.blocks)) {
        throw new Error(
          `Missing block number for date ${dateStr} for distributor ${distributorAddress}`,
        );
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  // Implement abstract methods
  async processDailyData(
    distributorAddress: string,
    _date: string,
    startBlock: number,
    endBlock: number,
  ): Promise<ethers.Log[]> {
    // Query RecipientRecieved events for this block range
    return this.queryRecipientRecievedEvents(
      distributorAddress,
      startBlock,
      endBlock,
    );
  }

  async finalizeDistributorData(
    distributorAddress: string,
    results: ethers.Log[][],
    lastProcessedBlock: number,
  ): Promise<void> {
    // Flatten the array of arrays into a single array of logs
    const allEvents = results.flat();

    // Get existing event data
    const existingEventData =
      this.fileManager.readRecipientRecievedEvents(distributorAddress);

    // Get chain ID from distributors data
    const distributorsData = this.fileManager.readDistributors();
    const chainId = distributorsData?.metadata.chain_id || 0;

    // Parse and store events
    this.parseAndStoreEvents(
      distributorAddress,
      allEvents,
      chainId,
      lastProcessedBlock,
      existingEventData,
    );
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
    // Delegate to the base class processDistributors method
    return this.processDistributors(distributorAddress);
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
