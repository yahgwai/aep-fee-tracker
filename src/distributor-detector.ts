import { ethers } from "ethers";
import { FileManager } from "./file-manager";
import { DistributorType, DISTRIBUTOR_METHODS } from "./types";
import { REWARD_DISTRIBUTOR_BYTECODE } from "./constants/reward-distributor-bytecode";

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
}
