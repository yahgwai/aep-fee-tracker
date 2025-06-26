import { ethers } from "ethers";
import { Configuration } from "./types";
import { FileManager } from "./file-manager";
import { BlockFinder } from "./block-finder";
import { DistributorDetector } from "./distributor-detector";
import { BalanceFetcher } from "./balance-fetcher";
import { RecipientRecievedScanner } from "./recipient-recieved-scanner";
import { FeeCalculator } from "./fee-calculator";

export async function orchestrate(config: Configuration): Promise<void> {
  // Initialize infrastructure
  const fileManager = new FileManager(config.storeDirectory);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  fileManager.ensureStoreDirectory();

  // Parse date range
  const { startDate, endDate } = await parseDateRange(config, provider);

  // Execute pipeline components sequentially
  await executePipeline(fileManager, provider, startDate, endDate);
}

async function parseDateRange(
  config: Configuration,
  provider: ethers.Provider,
): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  // Default to yesterday for end date (since we can only process complete days)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  // Determine start date
  let startDate: Date;
  if (config.startDate) {
    startDate = new Date(config.startDate);
    if (isNaN(startDate.getTime())) {
      throw new Error("Invalid start date format");
    }
  } else {
    // Fetch block 1 to get chain start timestamp
    const block1 = await provider.getBlock(1);
    if (!block1) {
      throw new Error("Failed to fetch block 1 from provider");
    }
    startDate = new Date(block1.timestamp * 1000);
    startDate.setUTCHours(0, 0, 0, 0);
  }

  const endDate = config.endDate ? new Date(config.endDate) : yesterday;
  if (config.endDate && isNaN(endDate.getTime())) {
    throw new Error("Invalid end date format");
  }

  // Validate date range
  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  return { startDate, endDate };
}

async function executePipeline(
  fileManager: FileManager,
  provider: ethers.Provider,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  // 1. Find blocks for date range
  const blockFinder = new BlockFinder(fileManager, provider);
  await blockFinder.findBlocksForDateRange(startDate, endDate);

  // 2. Detect distributors up to end date
  const distributorDetector = new DistributorDetector(fileManager, provider);
  await distributorDetector.detectDistributors(endDate);

  // 3. Fetch distributor balances
  const balanceFetcher = new BalanceFetcher(fileManager, provider);
  await balanceFetcher.fetchBalances();

  // 4. Scan for recipient received events
  const recipientRecievedScanner = new RecipientRecievedScanner(
    provider,
    fileManager,
  );
  await recipientRecievedScanner.scan();

  // 5. Calculate fees
  const feeCalculator = new FeeCalculator(fileManager);
  feeCalculator.calculateFees();
}
