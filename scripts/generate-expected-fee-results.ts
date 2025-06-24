#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import {
  DistributorsData,
  BalanceData,
  RecipientRecievedEventData,
  FeeReport,
  BlockNumberData,
} from "../src/types";

// Read JSON file helper
function readJsonFile<T>(filePath: string): T | null {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

// Write JSON file helper
function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Map block number to date using block_numbers.json
// The blocks in block_numbers.json represent the END of each day
function blockToDate(
  blockNumber: number,
  blockData: BlockNumberData,
): string | null {
  const dates = Object.entries(blockData.blocks).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  // Find the first date whose end-of-day block is >= the given block
  for (let i = 0; i < dates.length; i++) {
    const [date, endOfDayBlock] = dates[i];

    if (blockNumber <= endOfDayBlock) {
      return date;
    }
  }

  // If block is beyond our data, return the last date
  if (dates.length > 0) {
    return dates[dates.length - 1][0];
  }

  return null;
}

// Calculate daily balance changes
function calculateBalanceChanges(
  balanceData: BalanceData,
): Map<string, { start: string; end: string; change: string }> {
  const changes = new Map<
    string,
    { start: string; end: string; change: string }
  >();
  const dates = Object.keys(balanceData.balances).sort();

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const currentBalance = balanceData.balances[date].balance_wei;

    // For first day, previous balance is 0
    const previousBalance =
      i > 0 ? balanceData.balances[dates[i - 1]].balance_wei : "0";

    // Calculate change
    const change = (
      BigInt(currentBalance) - BigInt(previousBalance)
    ).toString();

    changes.set(date, {
      start: previousBalance,
      end: currentBalance,
      change: change,
    });
  }

  return changes;
}

// Sum distribution events by date
function sumEventsByDate(
  events: RecipientRecievedEventData,
  blockData: BlockNumberData,
): Map<string, { total: string; count: number }> {
  const eventsByDate = new Map<string, { total: string; count: number }>();

  if (!events.events || Array.isArray(events.events)) {
    // Handle the case where events is an array or empty
    if (Array.isArray(events.events)) {
      for (const event of events.events) {
        const date = blockToDate(event.blockNumber, blockData);
        if (date) {
          const existing = eventsByDate.get(date) || { total: "0", count: 0 };
          existing.total = (
            BigInt(existing.total) + BigInt(event.value)
          ).toString();
          existing.count += 1;
          eventsByDate.set(date, existing);
        }
      }
    }
    return eventsByDate;
  }

  // Handle the case where events is an object with keys
  for (const event of Object.values(events.events)) {
    const date = blockToDate(event.blockNumber, blockData);
    if (date) {
      const existing = eventsByDate.get(date) || { total: "0", count: 0 };
      existing.total = (
        BigInt(existing.total) + BigInt(event.value)
      ).toString();
      existing.count += 1;
      eventsByDate.set(date, existing);
    }
  }

  return eventsByDate;
}

// Main function
async function main() {
  const testDataDir = path.join(__dirname, "../__tests__/test-data");

  // Read distributors
  const distributorsPath = path.join(
    testDataDir,
    "distributor-detector/distributors.json",
  );
  const distributors = readJsonFile<DistributorsData>(distributorsPath);
  if (!distributors) {
    console.error("Failed to read distributors.json");
    return;
  }

  // Read block numbers for date mapping
  const blockNumbersPath = path.join(
    testDataDir,
    "distributor-detector/block_numbers.json",
  );
  const blockNumbers = readJsonFile<BlockNumberData>(blockNumbersPath);
  if (!blockNumbers) {
    console.error("Failed to read block_numbers.json");
    return;
  }

  // Initialize fee report
  const feeReport: FeeReport = {
    metadata: {
      chain_id: distributors.metadata.chain_id,
    },
    distributors: {},
  };

  // Process each distributor
  for (const [address, info] of Object.entries(distributors.distributors)) {
    console.log(`\nProcessing distributor: ${address} (${info.type})`);

    // Read balance data
    const balancePath = path.join(
      testDataDir,
      `distributor-detector/balance_data/${address}/balances.json`,
    );
    const balanceData = readJsonFile<BalanceData>(balancePath);
    if (!balanceData) {
      console.warn(`No balance data found for ${address}`);
      continue;
    }

    // Read event data
    const eventPath = path.join(
      testDataDir,
      `recipient-recieved/${address}.json`,
    );
    const eventData = readJsonFile<RecipientRecievedEventData>(eventPath);
    if (!eventData) {
      console.warn(`No event data found for ${address}`);
    }

    // Calculate balance changes
    const balanceChanges = calculateBalanceChanges(balanceData);

    // Sum events by date
    const eventsByDate = eventData
      ? sumEventsByDate(eventData, blockNumbers)
      : new Map();

    // Build daily fee entries
    const dailyFees = [];

    // Get all unique dates from both balance and event data
    const allDates = new Set([
      ...balanceChanges.keys(),
      ...eventsByDate.keys(),
    ]);
    const sortedDates = Array.from(allDates).sort();

    for (const date of sortedDates) {
      const balance = balanceChanges.get(date) || {
        start: "0",
        end: "0",
        change: "0",
      };
      const events = eventsByDate.get(date) || { total: "0", count: 0 };

      // Total = balance change + distributions
      const total = (BigInt(balance.change) + BigInt(events.total)).toString();

      dailyFees.push({
        date: date,
        start_balance_wei: balance.start,
        end_balance_wei: balance.end,
        balance_change_wei: balance.change,
        distributions_wei: events.total,
        distributions_count: events.count,
        total_wei: total,
      });
    }

    feeReport.distributors[address] = dailyFees;
    console.log(`  - Processed ${dailyFees.length} days of data`);
  }

  // Write output
  const outputPath = path.join(
    testDataDir,
    "fee-calculator/expected-results.json",
  );
  writeJsonFile(outputPath, feeReport);

  console.log(`\nExpected results written to: ${outputPath}`);
  console.log(
    `Total distributors processed: ${Object.keys(feeReport.distributors).length}`,
  );
}

// Run the script
main().catch(console.error);
