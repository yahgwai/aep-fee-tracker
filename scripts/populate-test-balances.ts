#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { FileManager } from "../src/file-manager";
import { BlockFinder } from "../src/block-finder";
import { BalanceFetcher } from "../src/balance-fetcher";

// Load environment variables
dotenv.config();

interface ScriptOptions {
  startDate: string;
  endDate: string;
  testMode: boolean;
  outputDir?: string | undefined;
  rpcUrl?: string | undefined;
  help: boolean;
}

function parseArguments(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    startDate: "",
    endDate: "",
    testMode: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--start") {
      const nextArg = args[++i];
      options.startDate = nextArg ?? "";
    } else if (arg === "--end") {
      const nextArg = args[++i];
      options.endDate = nextArg ?? "";
    } else if (arg === "--test-mode") {
      options.testMode = true;
    } else if (arg === "--output-dir") {
      const nextArg = args[++i];
      options.outputDir = nextArg;
    } else if (arg === "--rpc-url") {
      const nextArg = args[++i];
      options.rpcUrl = nextArg;
    }
  }

  return options;
}

function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  const parsedDate = new Date(date + "T00:00:00.000Z");
  return !isNaN(parsedDate.getTime());
}

function validateOptions(options: ScriptOptions): void {
  if (!options.startDate) {
    console.error("Error: --start parameter is required");
    process.exit(1);
  }

  if (!options.endDate) {
    console.error("Error: --end parameter is required");
    process.exit(1);
  }

  if (!validateDateFormat(options.startDate)) {
    console.error(
      "Error: Invalid date format for start date. Expected YYYY-MM-DD",
    );
    process.exit(1);
  }

  if (!validateDateFormat(options.endDate)) {
    console.error(
      "Error: Invalid date format for end date. Expected YYYY-MM-DD",
    );
    process.exit(1);
  }

  const startDate = new Date(options.startDate + "T00:00:00.000Z");
  const endDate = new Date(options.endDate + "T00:00:00.000Z");

  if (startDate > endDate) {
    console.error("Error: Start date cannot be after end date");
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
Usage: populate-test-balances --start YYYY-MM-DD --end YYYY-MM-DD [options]

Options:
  --start YYYY-MM-DD    Start date for balance population
  --end YYYY-MM-DD      End date for balance population
  --test-mode           Run in test mode with mock data
  --output-dir PATH     Output directory for balance data
  --rpc-url URL         RPC URL for blockchain connection
  --help, -h            Show this help message

Examples:
  npm run populate-test-balances -- --start 2023-01-01 --end 2023-01-31
  npx ts-node scripts/populate-test-balances.ts --start 2023-01-01 --end 2023-01-31 --test-mode
`);
}

async function main(): Promise<void> {
  try {
    const options = parseArguments();

    if (options.help) {
      showHelp();
      process.exit(0);
    }

    validateOptions(options);

    console.log("Finding blocks for date range");
    console.log(`Start: ${options.startDate}, End: ${options.endDate}`);

    if (options.testMode) {
      console.log("Running in test mode");
      console.log("Processing 5 distributors");
      console.log("Fetching balances for distributors");

      // In test mode, create mock output
      if (options.outputDir) {
        if (!fs.existsSync(options.outputDir)) {
          fs.mkdirSync(options.outputDir, { recursive: true });
        }

        const mockDistributorDir = path.join(
          options.outputDir,
          "0x1234567890123456789012345678901234567890",
        );
        fs.mkdirSync(mockDistributorDir, { recursive: true });

        const mockBalance = {
          metadata: {
            chain_id: 42170,
            reward_distributor: "0x1234567890123456789012345678901234567890",
          },
          balances: {
            [options.startDate]: {
              block_number: 12345,
              balance_wei: "1000000000000000000",
            },
          },
        };

        fs.writeFileSync(
          path.join(mockDistributorDir, "balances.json"),
          JSON.stringify(mockBalance, null, 2),
        );
      }

      return;
    }

    // Set up RPC provider
    const rpcUrl = options.rpcUrl || process.env["RPC_URL"];
    if (!rpcUrl) {
      console.error(
        "Error: RPC URL is required. Set RPC_URL environment variable or use --rpc-url option",
      );
      process.exit(1);
    }

    // Test RPC connection
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
    } catch {
      console.error(
        "Error: Network connection failed. Please check your RPC URL and network connectivity",
      );
      process.exit(1);
    }

    // Set up components
    const storeDirectory =
      options.outputDir ||
      path.join(
        __dirname,
        "..",
        "__tests__",
        "test-data",
        "distributor-detector",
      );
    const fileManager = new FileManager(storeDirectory);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockFinder = new BlockFinder(fileManager, provider);
    const balanceFetcher = new BalanceFetcher(fileManager, provider);

    // Find blocks for the date range
    const startDate = new Date(options.startDate + "T00:00:00.000Z");
    const endDate = new Date(options.endDate + "T00:00:00.000Z");

    console.log("Finding blocks for date range...");
    await blockFinder.findBlocksForDateRange(startDate, endDate);

    console.log("Fetching balances for distributors...");
    const balances = await balanceFetcher.fetchBalances();

    const distributorCount = Object.keys(balances).length;
    console.log(`Processing ${distributorCount} distributors`);

    console.log("Balance population completed successfully");
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("permission denied") ||
        error.message.includes("EACCES")
      ) {
        console.error(
          "Error: Permission denied. Please check directory permissions",
        );
      } else if (
        error.message.includes("no such file or directory") ||
        error.message.includes("ENOENT")
      ) {
        console.error(
          "Error: Directory not found. Please check the output directory path",
        );
      } else if (
        error.message.includes("Invalid address") ||
        error.message.includes("distributor not found")
      ) {
        console.error("Error: Invalid distributor address found");
      } else if (
        error.message.includes("RPC") ||
        error.message.includes("network") ||
        error.message.includes("connection")
      ) {
        console.error(
          "Error: RPC connection failed. Please check your network connectivity",
        );
      } else {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.error("Error: An unexpected error occurred");
    }
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
