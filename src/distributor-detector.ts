import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import {
  DistributorType,
  DISTRIBUTOR_METHODS,
  DistributorInfo,
  withRetry,
} from "./types";
import { REWARD_DISTRIBUTOR_BYTECODE } from "./constants/reward-distributor-bytecode";
import {
  OWNER_ACTS_EVENT_ABI,
  ARBOWNER_PRECOMPILE_ADDRESS,
  OWNER_ACTS_EVENT_SIGNATURE,
  ALL_DISTRIBUTOR_METHOD_SIGNATURES,
} from "./constants/distributor-detector";

/**
 * Creates a new DistributorDetector instance with the specified dependencies.
 *
 * @param fileManager - File manager instance for data persistence
 * @param provider - Nova provider for RPC calls
 */
export class DistributorDetector {
  constructor(
    public readonly fileManager: FileManager,
    public readonly provider: ethers.Provider,
  ) {}

  static getDistributorType(methodSignature: string): DistributorType | null {
    switch (methodSignature) {
      case DISTRIBUTOR_METHODS.L2_BASE_FEE:
        return DistributorType.L2_BASE_FEE;
      case DISTRIBUTOR_METHODS.L2_SURPLUS_FEE:
        return DistributorType.L2_SURPLUS_FEE;
      case DISTRIBUTOR_METHODS.L1_SURPLUS_FEE:
        return DistributorType.L1_SURPLUS_FEE;
      default:
        return null;
    }
  }

  static async isRewardDistributor(
    provider: ethers.Provider,
    address: string,
  ): Promise<boolean> {
    try {
      const deployedCode = await provider.getCode(address);
      return deployedCode === REWARD_DISTRIBUTOR_BYTECODE;
    } catch {
      return false;
    }
  }

  /**
   * Parses an OwnerActs event log to extract distributor creation information.
   *
   * @param log - The ethers.Log object containing the event data
   * @param blockTimestamp - The timestamp of the block containing the event
   * @param provider - The ethers provider to check if the distributor is a reward distributor
   * @returns DistributorInfo object if the event is a valid distributor creation
   * @throws Error if the event is invalid or malformed
   */
  static async parseDistributorCreation(
    log: ethers.Log,
    blockTimestamp: number,
    provider: ethers.Provider,
  ): Promise<DistributorInfo> {
    // Parse the OwnerActs event
    const iface = new ethers.Interface(OWNER_ACTS_EVENT_ABI);
    const parsedLog = iface.parseLog(log);

    if (!parsedLog) {
      throw new Error("Failed to parse log as OwnerActs event");
    }

    // Extract event arguments
    const method = parsedLog.args["method"];
    const owner = parsedLog.args["owner"];
    const eventData = parsedLog.args["data"];

    // Check if this is a distributor creation method
    const distributorType = this.getDistributorType(method);
    if (!distributorType) {
      throw new Error(`Unknown distributor method signature: ${method}`);
    }

    // Validate data field has minimum length for method selector (4 bytes = 8 hex chars + 0x)
    const METHOD_SELECTOR_LENGTH = 10; // "0x" + 8 hex chars
    if (eventData.length < METHOD_SELECTOR_LENGTH) {
      throw new Error(
        `Event data field too short: expected at least ${METHOD_SELECTOR_LENGTH} characters, got ${eventData.length}`,
      );
    }

    // Decode and validate the distributor address from the data field
    let distributorAddress: string;
    try {
      [distributorAddress] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"],
        "0x" + eventData.substring(METHOD_SELECTOR_LENGTH),
      );
    } catch (error) {
      throw new Error(
        `Failed to decode distributor address from event data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Check if it's a reward distributor
    const isRewardDistributor = await this.isRewardDistributor(
      provider,
      distributorAddress,
    );

    // Convert timestamp to ISO date string
    const date = new Date(blockTimestamp * 1000);
    const dateString = date.toISOString().split("T")[0]!;

    // Return distributor info
    return {
      type: distributorType,
      block: log.blockNumber,
      date: dateString,
      tx_hash: log.transactionHash,
      method: method,
      owner: owner,
      event_data: log.data,
      is_reward_distributor: isRewardDistributor,
      distributor_address: distributorAddress,
    };
  }

  /**
   * Processes a single log event to extract distributor information.
   * @private
   */
  private static async processLogEvent(
    log: ethers.Log,
    provider: ethers.Provider,
  ): Promise<DistributorInfo | null> {
    try {
      // Get block timestamp with retry logic
      const block = await withRetry(() => provider.getBlock(log.blockNumber), {
        maxRetries: 3,
        operationName: `scanBlockRange.getBlock(${log.blockNumber})`,
      });

      if (!block) {
        return null;
      }

      // Parse the event and create DistributorInfo
      return await this.parseDistributorCreation(
        log,
        block.timestamp,
        provider,
      );
    } catch {
      // Skip invalid events
      return null;
    }
  }

  /**
   * Scans a block range for distributor creation events and returns discovered distributors.
   *
   * @param provider - The ethers provider to query blockchain data
   * @param fromBlock - Starting block number (inclusive)
   * @param toBlock - Ending block number (inclusive)
   * @returns Array of DistributorInfo objects for discovered distributors
   */
  static async scanBlockRange(
    provider: ethers.Provider,
    fromBlock: number,
    toBlock: number,
  ): Promise<DistributorInfo[]> {
    // Construct filter with OR logic for method signatures
    const filter = {
      address: ARBOWNER_PRECOMPILE_ADDRESS,
      topics: [
        OWNER_ACTS_EVENT_SIGNATURE,
        [...ALL_DISTRIBUTOR_METHOD_SIGNATURES],
      ],
      fromBlock,
      toBlock,
    };

    // Query events with retry logic
    const logs = await withRetry(() => provider.getLogs(filter), {
      maxRetries: 3,
      operationName: "scanBlockRange.getLogs",
    });

    // Process all logs in parallel for better performance
    const processedResults = await Promise.all(
      logs.map((log) => this.processLogEvent(log, provider)),
    );

    // Filter out null results and sort by block number
    return processedResults
      .filter((info): info is DistributorInfo => info !== null)
      .sort((a, b) => a.block - b.block);
  }
}
