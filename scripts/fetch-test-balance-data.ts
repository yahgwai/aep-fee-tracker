#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { FileManager } from "../src/file-manager";
import { BalanceFetcher } from "../src/balance-fetcher";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting balance data fetching for test distributors...");

  // Load test data
  const rawEventsPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/distributor-creation-events-raw.json",
  );
  const blockNumbersPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/block_numbers.json",
  );

  const rawEvents = JSON.parse(fs.readFileSync(rawEventsPath, "utf-8"));
  const blockNumbersData = JSON.parse(
    fs.readFileSync(blockNumbersPath, "utf-8"),
  );

  // Parse distributor addresses
  console.log("Parsing distributor addresses from events...");
  const addresses = BalanceFetcher.parseDistributorAddresses(rawEvents.events);
  const uniqueAddresses = [...new Set(addresses)];
  console.log(`Found ${uniqueAddresses.length} unique distributor addresses`);

  // Get block numbers
  const blockNumbers = Object.values(blockNumbersData.blocks) as number[];
  console.log(`Will fetch balances at ${blockNumbers.length} blocks`);

  // Initialize provider (Arbitrum Nova)
  const rpcUrl =
    process.env.NOVA_RPC_ENDPOINT || "https://nova.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Verify we're on the correct chain
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 42170) {
    throw new Error(
      `Expected chain ID 42170 (Arbitrum Nova), got ${network.chainId}`,
    );
  }

  // Fetch all balances
  console.log(`Fetching balances from ${rpcUrl}...`);
  console.log("This may take a while due to RPC rate limits...");

  const allBalances = await BalanceFetcher.fetchAllDistributorBalances(
    provider,
    uniqueAddresses,
    blockNumbers,
  );

  // Initialize file manager for test data directory
  const testDataDir = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/balance-fetcher",
  );
  const fileManager = new FileManager(testDataDir);

  // Ensure directory exists
  fileManager.ensureStoreDirectory();

  // Save balance data
  console.log("Saving balance data...");
  await BalanceFetcher.saveBalanceData(
    fileManager,
    allBalances,
    blockNumbersData,
  );

  // Add metadata file
  const metadata = {
    generated_at: new Date().toISOString(),
    distributor_count: uniqueAddresses.length,
    block_count: blockNumbers.length,
    total_balance_points: uniqueAddresses.length * blockNumbers.length,
    rpc_endpoint: rpcUrl,
    chain_id: 42170,
  };

  fs.writeFileSync(
    path.join(testDataDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  console.log("Balance data fetching completed successfully!");
  console.log(`Data saved to: ${testDataDir}`);
}

main().catch((error) => {
  console.error("Error fetching balance data:", error);
  process.exit(1);
});
