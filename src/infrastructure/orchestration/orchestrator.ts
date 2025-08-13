import { ethers } from "ethers";
import { Configuration } from "../../types";
import { FileManager } from "../storage/file-manager";
import { GcsSync } from "../storage/gcs-sync";
import { BlockFinder } from "../../core/block-processing/block-finder";
import { DistributorDetector } from "../../core/distributor-detection/distributor-detector";
import { BalanceFetcher } from "../../core/fee-calculation/balance-fetcher";
import { RecipientRecievedScanner } from "../../core/fee-calculation/recipient-recieved-scanner";
import { FeeCalculator } from "../../core/fee-calculation/fee-calculator";
import { getYesterday } from "../../utils/date-utils";
import { logger } from "../../utils/logger";

export async function orchestrate(config: Configuration): Promise<void> {
  logger.log("Starting fee calculator pipeline...");

  // Initialize infrastructure
  const fileManager = new FileManager(config.storeDirectory);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  fileManager.ensureStoreDirectory();

  // Initialize GCS sync if bucket is provided
  let gcsSync: GcsSync | undefined;
  if (config.gcsBucket) {
    console.log(`🔗 Initializing GCS sync with bucket: ${config.gcsBucket}`);
    gcsSync = new GcsSync(
      config.gcsBucket,
      "raw/aep_fee/router",
      config.chain ? `chain=${config.chain}` : undefined,
    );

    // Download existing store data from GCS
    console.log("📥 Downloading existing store data from GCS...");
    await gcsSync.downloadStore(config.storeDirectory);
  }

  try {
    // Parse date range (after potentially downloading existing data)
    const { startDate, endDate } = await parseDateRange(
      config,
      fileManager,
      provider,
    );

    // Execute pipeline components sequentially
    await executePipeline(fileManager, provider, startDate, endDate);

    console.log("✅ Pipeline completed successfully");
  } catch (error) {
    console.error("❌ Pipeline failed:", error);
    throw error;
  } finally {
    // Upload store data to GCS if configured (runs on success or failure)
    if (gcsSync) {
      console.log("📤 Uploading store data to GCS...");
      try {
        await gcsSync.uploadStore(config.storeDirectory);
      } catch (uploadError) {
        console.error("❌ Failed to upload to GCS:", uploadError);
      }
    }
  }
}

async function parseDateRange(
  config: Configuration,
  fileManager: FileManager,
  provider: ethers.Provider,
): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  // Determine end date
  const endDate = config.endDate
    ? parseConfigDate(config.endDate, "end")
    : getYesterday();

  // Determine start date
  let startDate: Date;
  if (config.startDate) {
    startDate = parseConfigDate(config.startDate, "start");
  } else {
    const maxDate = fileManager.getMaxDate();
    if (maxDate) {
      // Subsequent run: use max date from store
      startDate = maxDate;
    } else {
      // First run: use the date of block 1
      const block1 = await provider.getBlock(1);
      if (!block1) {
        throw new Error("Unable to fetch block 1 from the network");
      }
      startDate = new Date(block1.timestamp * 1000);
    }
  }

  // Ensure valid date range
  if (startDate > endDate) {
    startDate = endDate;
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

async function executePipeline(
  fileManager: FileManager,
  provider: ethers.Provider,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  // 1. Find blocks for date range
  logger.log("Starting Block Finder...");
  const blockFinder = new BlockFinder(fileManager, provider);
  await blockFinder.findBlocksForDateRange(startDate, endDate);

  // 2. Detect distributors up to end date
  logger.log("Starting Distributor Detector...");
  const distributorDetector = new DistributorDetector(fileManager, provider);
  await distributorDetector.detectDistributors(endDate);

  // 3. Fetch distributor balances
  logger.log("Starting Balance Fetcher...");
  const balanceFetcher = new BalanceFetcher(fileManager, provider);
  await balanceFetcher.fetchBalances();

  // 4. Scan for recipient received events
  logger.log("Starting Recipient Received Scanner...");
  const recipientRecievedScanner = new RecipientRecievedScanner(
    provider,
    fileManager,
  );
  await recipientRecievedScanner.scan();

  // 5. Calculate fees
  logger.log("Starting Fee Calculator...");
  const feeCalculator = new FeeCalculator(fileManager);
  feeCalculator.calculateFees();

  logger.log("Pipeline completed successfully");
}
