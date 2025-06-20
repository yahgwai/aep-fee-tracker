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
    private readonly fileManager: FileManager,
    private readonly provider: ethers.Provider,
  ) {}

  // TODO: Implement detect method in future issue
  async detect(): Promise<void> {
    // Method stub to satisfy TypeScript compiler
    // Will be implemented when handling distributor detection logic
    void this.fileManager;
    void this.provider;
  }
}
