import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorType, DISTRIBUTOR_METHODS, DistributorInfo } from "./types";
import { REWARD_DISTRIBUTOR_BYTECODE } from "./constants/reward-distributor-bytecode";
import { OWNER_ACTS_EVENT_ABI } from "./constants/distributor-detector";

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
    };
  }
}
