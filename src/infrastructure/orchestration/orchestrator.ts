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

export async function orchestrate(config: Configuration): Promise<void> {
  console.log("Starting fee calculator pipeline...");

  // Initialize infrastructure
  const fileManager = new FileManager(config.storeDirectory);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  fileManager.ensureStoreDirectory();

  // Initialize GCS sync if bucket is provided
  let gcsSync: GcsSync | undefined;
  if (config.gcsBucket) {
    console.log(`🔗 Initializing GCS sync with bucket: ${config.gcsBucket}`);
    gcsSync = new GcsSync(config.gcsBucket, "aep-fee-tracker", config.chain);

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

    // Upload updated store data to GCS if configured
    if (gcsSync) {
      console.log("📤 Uploading updated store data to GCS...");
      await gcsSync.uploadStore(config.storeDirectory);
    }

    console.log("✅ Pipeline completed successfully");
  } catch (error) {
    console.error("❌ Pipeline failed:", error);

    // Still try to upload partial results to GCS if configured
    if (gcsSync) {
      console.log("📤 Uploading partial results to GCS...");
      try {
        await gcsSync.uploadStore(config.storeDirectory);
      } catch (uploadError) {
        console.error("❌ Failed to upload to GCS:", uploadError);
      }
    }

    throw error;
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
}
