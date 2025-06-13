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

  if (startDate.getTime() === endDate.getTime()) {
    return result;
  }

  for (const date of datesBetween(startDate, endDate)) {
    await processDate(date, result, provider, fileManager, safeCurrentBlock);
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
  const { blocks } = fileManager.readBlockNumbers();
  return {
    metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
    blocks: { ...blocks },
  };
}

async function processDate(
  date: Date,
  result: BlockNumberData,
  provider: ethers.Provider,
  fileManager: FileManager,
  safeCurrentBlock: number,
): Promise<void> {
  const dateStr = formatDateString(date);

  if (result.blocks[dateStr]) {
    return;
  }

  const [lowerBound, upperBound] = getSearchBounds(
    date,
    result,
    safeCurrentBlock,
  );

  if (upperBound > safeCurrentBlock) {
    return;
  }

  try {
    const blockNumber = await findEndOfDayBlock(
      date,
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

  const targetTimestamp = toUnixTimestamp(getNextMidnight(date));
  const dateStartTimestamp = toUnixTimestamp(getMidnight(date));

  const [lowerBlock, upperBlock] = await Promise.all([
    provider.getBlock(lowerBound),
    provider.getBlock(upperBound),
  ]);

  if (!lowerBlock) throw new Error(`Block ${lowerBound} not found`);
  if (!upperBlock) throw new Error(`Block ${upperBound} not found`);

  validateBlockRange(
    date,
    lowerBlock,
    upperBlock,
    lowerBound,
    upperBound,
    targetTimestamp,
    dateStartTimestamp,
  );

  const lastValidBlock = await binarySearchForBlock(
    provider,
    lowerBound,
    upperBound,
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

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);

    if (!block) {
      throw new Error(`Block ${mid} not found during search`);
    }

    if (block.timestamp < targetTimestamp) {
      lastValidBlock = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
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
  const lowerBound = findMostRecentBlock(dateStr, existingBlocks);
  const upperBound = estimateUpperBound(lowerBound, safeCurrentBlock);

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

function* datesBetween(start: Date, end: Date): Generator<Date> {
  const current = new Date(start);
  while (current <= end) {
    yield new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

function validateBlockRange(
  date: Date,
  lowerBlock: ethers.Block,
  upperBlock: ethers.Block,
  lowerBound: number,
  upperBound: number,
  targetTimestamp: number,
  dateStartTimestamp: number,
): void {
  if (lowerBlock.timestamp >= targetTimestamp) {
    throw new Error(
      `All blocks in range are after midnight\n` +
        `  Date: ${formatDateString(date)}\n` +
        `  Target: Before ${fromUnixTimestamp(targetTimestamp).toISOString()}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Lower block ${lowerBound} timestamp: ${fromUnixTimestamp(lowerBlock.timestamp).toISOString()}`,
    );
  }

  if (upperBlock.timestamp < dateStartTimestamp) {
    throw new Error(
      `All blocks in range are before the target date\n` +
        `  Date: ${formatDateString(date)}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Upper block ${upperBound} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}`,
    );
  }
}

function findMostRecentBlock(
  targetDate: string,
  existingBlocks: BlockNumberData,
): number {
  const dates = Object.keys(existingBlocks.blocks).sort();
  let mostRecent = 0;

  for (const date of dates) {
    if (date >= targetDate) break;
    mostRecent = existingBlocks.blocks[date]!;
  }

  return mostRecent;
}

function estimateUpperBound(
  lowerBound: number,
  safeCurrentBlock: number,
): number {
  const daysToSearch = lowerBound === 0 ? DEFAULT_DAYS_TO_SEARCH : 1;
  const estimatedBlocks = daysToSearch * BLOCKS_PER_DAY;
  return Math.min(lowerBound + estimatedBlocks, safeCurrentBlock);
}
