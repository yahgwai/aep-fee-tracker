import { ethers } from "ethers";
import { Configuration } from "./types";
import { FileManager } from "./file-manager";
import { BlockFinder } from "./block-finder";
import { DistributorDetector } from "./distributor-detector";
import { BalanceFetcher } from "./balance-fetcher";
import { RecipientRecievedScanner } from "./recipient-recieved-scanner";
import { FeeCalculator } from "./fee-calculator";

export async function orchestrate(config: Configuration): Promise<void> {
  // Create dependencies
  const fileManager = new FileManager(config.storeDirectory);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  // Ensure store directory exists
  fileManager.ensureStoreDirectory();

  // Determine date range
  const startDate = config.startDate ? new Date(config.startDate) : new Date();
  const endDate = config.endDate ? new Date(config.endDate) : new Date();

  // Set time to 00:00:00 UTC for today's date if no dates provided
  if (!config.startDate) {
    startDate.setUTCHours(0, 0, 0, 0);
  }
  if (!config.endDate) {
    endDate.setUTCHours(0, 0, 0, 0);
  }

  // Execute components in sequence

  // 1. Block Finder
  const blockFinder = new BlockFinder(fileManager, provider);
  await blockFinder.findBlocksForDateRange(startDate, endDate);

  // 2. Distributor Detector
  const distributorDetector = new DistributorDetector(fileManager, provider);
  await distributorDetector.detectDistributors(endDate);

  // 3. Balance Fetcher
  const balanceFetcher = new BalanceFetcher(fileManager, provider);
  await balanceFetcher.fetchBalances();

  // 4. Recipient Recieved Scanner
  const recipientRecievedScanner = new RecipientRecievedScanner(
    provider,
    fileManager,
  );
  await recipientRecievedScanner.scan();

  // 5. Fee Calculator
  const feeCalculator = new FeeCalculator(fileManager);
  feeCalculator.calculateFees();
}
