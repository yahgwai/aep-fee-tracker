import { ethers } from "ethers";
import { BlockNumberData, DateString, FileManager, CHAIN_IDS } from "./types";

const BLOCKS_PER_SECOND = 4;
const SECONDS_PER_DAY = 86400;
const BLOCKS_PER_DAY = BLOCKS_PER_SECOND * SECONDS_PER_DAY;
const FINALITY_BLOCKS = 1000;
const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_DAYS_TO_SEARCH = 365;
const MINIMUM_VALID_BLOCK = 1;

export async function findBlocksForDateRange(
  startDate: Date,
  endDate: Date,
  provider: ethers.Provider,
  fileManager: FileManager,
): Promise<BlockNumberData> {
  validateDateRange(startDate, endDate);

  const result = initializeResult(fileManager);
  const safeCurrentBlock = await getSafeCurrentBlock(provider);

  // Handle empty date range
  if (startDate.getTime() === endDate.getTime()) {
    return result;
  }

  // Process each date in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    await processDate(
      currentDate,
      result,
      provider,
      fileManager,
      safeCurrentBlock,
    );
    advanceDate(currentDate);
  }

  return result;
}

function validateDateRange(startDate: Date, endDate: Date): void {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new Error("Invalid Date object");
  }

  if (startDate > endDate) {
    throw new Error("Start date must not be after end date");
  }
}

function initializeResult(fileManager: FileManager): BlockNumberData {
  const existingData = fileManager.readBlockNumbers();
  return {
    metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
    blocks: { ...existingData.blocks },
  };
}

async function processDate(
  currentDate: Date,
  result: BlockNumberData,
  provider: ethers.Provider,
  fileManager: FileManager,
  safeCurrentBlock: number,
): Promise<void> {
  const dateStr = formatDateString(currentDate);

  // Skip if we already have this date
  if (result.blocks[dateStr]) {
    return;
  }

  const [lowerBound, upperBound] = getSearchBounds(
    currentDate,
    result,
    safeCurrentBlock,
  );

  // Skip if date is too recent
  if (upperBound > safeCurrentBlock) {
    return;
  }

  try {
    const blockNumber = await findEndOfDayBlock(
      currentDate,
      provider,
      lowerBound,
      upperBound,
    );
    result.blocks[dateStr] = blockNumber;
    fileManager.writeBlockNumbers(result);
  } catch (error) {
    handleBlockFindingError(error, dateStr);
  }
}

function handleBlockFindingError(error: unknown, dateStr: string): never {
  if (
    error instanceof Error &&
    error.message.includes("Unable to find block")
  ) {
    throw error;
  }
  throw new Error(`Failed to find block for ${dateStr}: ${error}`);
}

export async function findEndOfDayBlock(
  date: Date,
  provider: ethers.Provider,
  lowerBound: number,
  upperBound: number,
): Promise<number> {
  if (lowerBound > upperBound) {
    throw new Error(
      "Invalid search bounds: lower bound is greater than upper bound",
    );
  }

  const targetMidnight = getNextMidnight(date);
  const targetTimestamp = toUnixTimestamp(targetMidnight);

  let low = lowerBound;
  let high = upperBound;

  // Check bounds first
  const lowerBlock = await provider.getBlock(low);
  if (!lowerBlock) {
    throw new Error(`Block ${low} not found`);
  }

  const upperBlock = await provider.getBlock(high);
  if (!upperBlock) {
    throw new Error(`Block ${high} not found`);
  }

  if (lowerBlock.timestamp >= targetTimestamp) {
    throw new Error(
      `All blocks in range are after midnight\n` +
        `  Date: ${date.toISOString().split("T")[0]}\n` +
        `  Target: Before ${targetMidnight.toISOString()}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Lower block ${low} timestamp: ${fromUnixTimestamp(lowerBlock.timestamp).toISOString()}`,
    );
  }

  const dateStart = getMidnight(date);
  const dateStartTimestamp = toUnixTimestamp(dateStart);

  if (upperBlock.timestamp < dateStartTimestamp) {
    throw new Error(
      `All blocks in range are before the target date\n` +
        `  Date: ${date.toISOString().split("T")[0]}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Upper block ${high} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}`,
    );
  }

  const lastValidBlock = await binarySearchForBlock(
    provider,
    low,
    high,
    targetTimestamp,
  );

  if (lastValidBlock === -1) {
    throw new Error(
      `Unable to find block before midnight for ${date.toISOString().split("T")[0]}`,
    );
  }

  return lastValidBlock;
}

async function binarySearchForBlock(
  provider: ethers.Provider,
  low: number,
  high: number,
  targetTimestamp: number,
): Promise<number> {
  let lastValidBlock = -1;
  let currentLow = low;
  let currentHigh = high;

  while (currentLow <= currentHigh) {
    const mid = Math.floor((currentLow + currentHigh) / 2);
    const block = await provider.getBlock(mid);

    if (!block) {
      throw new Error(`Block ${mid} not found during search`);
    }

    if (block.timestamp < targetTimestamp) {
      lastValidBlock = mid;
      currentLow = mid + 1;
    } else {
      currentHigh = mid - 1;
    }
  }

  return lastValidBlock;
}

export async function getSafeCurrentBlock(
  provider: ethers.Provider,
): Promise<number> {
  try {
    const currentBlock = await provider.getBlockNumber();
    return currentBlock - FINALITY_BLOCKS;
  } catch (error) {
    throw new Error(
      `Failed to get current block\n` +
        `  Error: ${error}\n` +
        `  Check: Ensure RPC_URL is accessible`,
    );
  }
}

export function getSearchBounds(
  date: Date,
  existingBlocks: BlockNumberData,
  safeCurrentBlock: number,
): [number, number] {
  const dateStr = formatDateString(date);
  const dates = Object.keys(existingBlocks.blocks).sort();

  // Find the most recent block before this date
  let lowerBound = 0;
  for (const existingDate of dates) {
    if (existingDate < dateStr) {
      lowerBound = existingBlocks.blocks[existingDate]!;
    }
  }

  // Estimate upper bound
  const daysSinceLastBlock = lowerBound === 0 ? DEFAULT_DAYS_TO_SEARCH : 1;
  const estimatedBlocks = daysSinceLastBlock * BLOCKS_PER_DAY;
  const upperBound = Math.min(lowerBound + estimatedBlocks, safeCurrentBlock);

  // Ensure lower bound is at least 1 (block 0 is invalid)
  return [Math.max(MINIMUM_VALID_BLOCK, lowerBound), upperBound];
}

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

function formatDateString(date: Date): DateString {
  return date.toISOString().split("T")[0]!;
}

function getNextMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight;
}

function getMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setUTCHours(0, 0, 0, 0);
  return midnight;
}

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / MILLISECONDS_PER_SECOND);
}

function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * MILLISECONDS_PER_SECOND);
}

function advanceDate(date: Date): void {
  date.setUTCDate(date.getUTCDate() + 1);
}
