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
  const { startDate, endDate } = parseDateRange(config);

  // Execute pipeline components sequentially
  await executePipeline(fileManager, provider, startDate, endDate);
}

function parseDateRange(config: Configuration): {
  startDate: Date;
  endDate: Date;
} {
  // Arbitrum Nova chain start date (based on earliest distributor deployment)
  const CHAIN_START_DATE = new Date("2022-07-12");
  CHAIN_START_DATE.setUTCHours(0, 0, 0, 0);

  // Default to yesterday for end date (since we can only process complete days)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const startDate = config.startDate
    ? new Date(config.startDate)
    : CHAIN_START_DATE;
  const endDate = config.endDate ? new Date(config.endDate) : yesterday;

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
