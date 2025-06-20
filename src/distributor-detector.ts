import { ethers } from "ethers";
import { FileManager } from "./file-manager";

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
}
