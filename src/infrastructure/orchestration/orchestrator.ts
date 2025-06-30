import { ethers } from "ethers";
import { Configuration } from "../../types";
import { FileManager } from "../storage/file-manager";
import { BlockFinder } from "../../core/block-processing/block-finder";
import { DistributorDetector } from "../../core/distributor-detection/distributor-detector";
import { BalanceFetcher } from "../../core/fee-calculation/balance-fetcher";
import { RecipientRecievedScanner } from "../../core/fee-calculation/recipient-recieved-scanner";
import { FeeCalculator } from "../../core/fee-calculation/fee-calculator";

export async function orchestrate(config: Configuration): Promise<void> {
  console.log("Starting fee calculator pipeline...");

  // Initialize infrastructure
  const fileManager = new FileManager(config.storeDirectory);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  fileManager.ensureStoreDirectory();

  // Parse date range
  const { startDate, endDate } = await parseDateRange(
    config,
    provider,
    fileManager,
  );

  // Execute pipeline components sequentially
  await executePipeline(fileManager, provider, startDate, endDate);
}

async function parseDateRange(
  config: Configuration,
  provider: ethers.Provider,
  fileManager: FileManager,
): Promise<{
  startDate: Date;
  endDate: Date;
}> {
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

  // Determine end date
  let endDate: Date;
  if (config.endDate) {
    endDate = new Date(config.endDate);
    if (isNaN(endDate.getTime())) {
      throw new Error("Invalid end date format");
    }
  } else {
    // Use max date from block store
    const maxDateStr = fileManager.getMaxDate();
    if (!maxDateStr) {
      throw new Error("No block data available in store");
    }
    endDate = new Date(maxDateStr);
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
  // Format endDate as YYYY-MM-DD string
  const endDateStr = endDate.toISOString().split("T")[0];

  // 1. Find blocks for date range
  console.log("Starting Block Finder...");
  const blockFinder = new BlockFinder(fileManager, provider);
  await blockFinder.findBlocksForDateRange(startDate, endDate);

  // 2. Detect distributors up to end date
  console.log("Starting Distributor Detector...");
  const distributorDetector = new DistributorDetector(fileManager, provider);
  await distributorDetector.detectDistributors(endDate);

  // 3. Fetch distributor balances
  console.log("Starting Balance Fetcher...");
  const balanceFetcher = new BalanceFetcher(fileManager, provider);
  await balanceFetcher.fetchBalances(undefined, endDateStr);

  // 4. Scan for recipient received events
  console.log("Starting Recipient Received Scanner...");
  const recipientRecievedScanner = new RecipientRecievedScanner(
    provider,
    fileManager,
  );
  await recipientRecievedScanner.scan(undefined, endDateStr);

  // 5. Calculate fees
  console.log("Starting Fee Calculator...");
  const feeCalculator = new FeeCalculator(fileManager);
  feeCalculator.calculateFees();

  console.log("Pipeline completed successfully");
}
