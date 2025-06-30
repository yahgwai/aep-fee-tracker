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
  const { startDate, endDate } = await parseDateRange(config, fileManager);

  // Execute pipeline components sequentially
  await executePipeline(fileManager, provider, startDate, endDate);
}

async function parseDateRange(
  config: Configuration,
  fileManager: FileManager,
): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  // Determine end date
  let endDate: Date;
  if (config.endDate) {
    endDate = new Date(config.endDate);
    if (isNaN(endDate.getTime())) {
      throw new Error("Invalid end date format");
    }
  } else {
    // Get max date from block numbers store
    const blockNumbersData = fileManager.readBlockNumbers();
    if (
      !blockNumbersData ||
      Object.keys(blockNumbersData.blocks).length === 0
    ) {
      throw new Error("No block numbers found in store and no dates provided");
    }

    const blockDates = Object.keys(blockNumbersData.blocks).sort();
    const maxDateStr = blockDates[blockDates.length - 1];
    if (!maxDateStr) {
      throw new Error("No block numbers found in store and no dates provided");
    }
    endDate = new Date(maxDateStr);
  }

  // Determine start date
  let startDate: Date;
  if (config.startDate) {
    startDate = new Date(config.startDate);
    if (isNaN(startDate.getTime())) {
      throw new Error("Invalid start date format");
    }
  } else {
    // Get min date from block numbers store
    const blockNumbersData = fileManager.readBlockNumbers();
    if (
      !blockNumbersData ||
      Object.keys(blockNumbersData.blocks).length === 0
    ) {
      throw new Error("No block numbers found in store and no dates provided");
    }

    const blockDates = Object.keys(blockNumbersData.blocks).sort();
    const minDateStr = blockDates[0];
    if (!minDateStr) {
      throw new Error("No block numbers found in store and no dates provided");
    }
    startDate = new Date(minDateStr);
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
  await balanceFetcher.fetchBalances();

  // 4. Scan for recipient received events
  console.log("Starting Recipient Received Scanner...");
  const recipientRecievedScanner = new RecipientRecievedScanner(
    provider,
    fileManager,
  );
  await recipientRecievedScanner.scan();

  // 5. Calculate fees
  console.log("Starting Fee Calculator...");
  const feeCalculator = new FeeCalculator(fileManager);
  feeCalculator.calculateFees();

  console.log("Pipeline completed successfully");
}
