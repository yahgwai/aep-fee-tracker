#!/usr/bin/env node
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { withRetry } from "../src/utils/retry";
import { DistributorDetector } from "../src/distributor-detector";
import { DistributorType } from "../src/types";

interface BlockNumberData {
  metadata: { chain_id: number };
  blocks: { [date: string]: number };
}

interface DistributorBalanceData {
  metadata: {
    chain_id: number;
    distributor_address: string;
    distributor_type: DistributorType;
    fetched_at: string;
  };
  balances: {
    [date: string]: {
      block_number: number;
      balance_wei: string;
    };
  };
}

async function main() {
  console.log("Starting balance fetcher for distributor test data...");

  // Load test data
  const rawEventsPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/distributor-creation-events-raw.json",
  );
  const blockNumbersPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/block_numbers.json",
  );

  const rawEventsData = JSON.parse(fs.readFileSync(rawEventsPath, "utf-8"));
  const blockNumbersData: BlockNumberData = JSON.parse(
    fs.readFileSync(blockNumbersPath, "utf-8"),
  );

  // Setup provider (Arbitrum Nova)
  const NOVA_RPC_URL = "https://nova.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(NOVA_RPC_URL);

  // Verify chain ID
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 42170) {
    throw new Error(
      `Expected Arbitrum Nova (chain ID 42170), got ${network.chainId}`,
    );
  }

  // Parse distributor addresses from events
  console.log("\nParsing distributor addresses from events...");
  const distributors: Map<
    string,
    { type: DistributorType; createdAt: number }
  > = new Map();

  for (const event of rawEventsData.events) {
    try {
      // Extract distributor address from event data
      const eventData = event.data;
      const METHOD_SELECTOR_LENGTH = 10; // "0x" + 8 hex chars

      if (eventData.length < METHOD_SELECTOR_LENGTH) {
        console.error(
          `Event data too short for block ${event.blockNumber}: ${eventData}`,
        );
        continue;
      }

      // The event data is encoded as bytes, which means:
      // - First 32 bytes (64 hex chars after 0x) is the offset to the data
      // - Next 32 bytes is the length of the data
      // - Then comes the actual data (method selector + address)

      // Decode the bytes data first
      const [bytesData] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["bytes"],
        eventData,
      );

      // Now skip the method selector (4 bytes = 8 hex chars) and decode the address
      const addressData = "0x" + bytesData.substring(10); // Skip "0x" + 8 hex chars
      const [distributorAddress] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"],
        addressData,
      );

      // Get distributor type from method in topics[1]
      const methodTopic = event.topics[1];
      const methodSignature = methodTopic.substring(0, 10); // Extract method signature
      const distributorType =
        DistributorDetector.getDistributorType(methodSignature);

      if (!distributorType) {
        console.error(
          `Unknown distributor method signature: ${methodSignature}`,
        );
        continue;
      }

      console.log(
        `  Block ${event.blockNumber}: ${distributorType} distributor at ${distributorAddress}`,
      );
      distributors.set(distributorAddress.toLowerCase(), {
        type: distributorType,
        createdAt: event.blockNumber,
      });
    } catch (error) {
      console.error(
        `Failed to parse event at block ${event.blockNumber}:`,
        error,
      );
    }
  }

  console.log(`\nFound ${distributors.size} unique distributors`);

  // Create output directory
  const outputDir = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/balance-fetcher",
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Fetch balances for each distributor at each block
  console.log("\nFetching balances...");
  const blockDates = Object.entries(blockNumbersData.blocks).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [address, info] of distributors) {
    console.log(`\nProcessing ${info.type} distributor: ${address}`);
    const balanceData: DistributorBalanceData = {
      metadata: {
        chain_id: 42170,
        distributor_address: address,
        distributor_type: info.type,
        fetched_at: new Date().toISOString(),
      },
      balances: {},
    };

    for (const [date, blockNumber] of blockDates) {
      // Only fetch balance if the distributor existed at this block
      if (blockNumber >= info.createdAt) {
        try {
          const balance = await withRetry(
            () => provider.getBalance(address, blockNumber),
            {
              maxRetries: 3,
              operationName: `getBalance(${address}, ${blockNumber})`,
            },
          );

          balanceData.balances[date] = {
            block_number: blockNumber,
            balance_wei: balance.toString(),
          };

          console.log(
            `  ${date} (block ${blockNumber}): ${ethers.formatEther(balance)} ETH`,
          );
        } catch (error) {
          console.error(
            `  Failed to fetch balance at block ${blockNumber}:`,
            error,
          );
          // Store as null to indicate fetch failure
          balanceData.balances[date] = {
            block_number: blockNumber,
            balance_wei: "0", // Use "0" as fallback
          };
        }
      } else {
        console.log(
          `  ${date} (block ${blockNumber}): Distributor not yet created`,
        );
      }
    }

    // Save balance data
    const outputPath = path.join(outputDir, `${address}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(balanceData, null, 2));
    console.log(`  Saved to: ${outputPath}`);
  }

  console.log("\nBalance fetching complete!");
}

// Run the script
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
