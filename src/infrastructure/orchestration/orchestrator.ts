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
  // Get dates from config or block store
  const endDate = config.endDate
    ? parseConfigDate(config.endDate, "end")
    : getMaxDateFromBlockStore(fileManager);

  const startDate = config.startDate
    ? parseConfigDate(config.startDate, "start")
    : getMinDateFromBlockStore(fileManager);

  // Validate date range
  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  return { startDate, endDate };
}

function parseConfigDate(dateStr: string, dateType: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${dateType} date format`);
  }
  return date;
}

function getDateRangeFromBlockStore(fileManager: FileManager): {
  sortedDates: string[];
} {
  const blockNumbersData = fileManager.readBlockNumbers();
  if (!blockNumbersData || Object.keys(blockNumbersData.blocks).length === 0) {
    throw new Error("No block numbers found in store and no dates provided");
  }

  const sortedDates = Object.keys(blockNumbersData.blocks).sort();
  if (sortedDates.length === 0) {
    throw new Error("No block numbers found in store and no dates provided");
  }

  return { sortedDates };
}

function getMaxDateFromBlockStore(fileManager: FileManager): Date {
  const { sortedDates } = getDateRangeFromBlockStore(fileManager);
  const maxDateStr = sortedDates[sortedDates.length - 1];
  if (!maxDateStr) {
    throw new Error("No block numbers found in store and no dates provided");
  }
  return new Date(maxDateStr);
}

function getMinDateFromBlockStore(fileManager: FileManager): Date {
  const { sortedDates } = getDateRangeFromBlockStore(fileManager);
  const minDateStr = sortedDates[0];
  if (!minDateStr) {
    throw new Error("No block numbers found in store and no dates provided");
  }
  return new Date(minDateStr);
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
