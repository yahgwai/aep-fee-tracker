import { ethers } from "ethers";
import { BlockNumberData, DateString, FileManager, CHAIN_IDS } from "./types";

const BLOCKS_PER_SECOND = 4;
const SECONDS_PER_DAY = 86400;
const BLOCKS_PER_DAY = BLOCKS_PER_SECOND * SECONDS_PER_DAY;
const FINALITY_BLOCKS = 1000;

export async function findBlocksForDateRange(
  startDate: Date,
  endDate: Date,
  provider: ethers.Provider,
  fileManager: FileManager,
): Promise<BlockNumberData> {
  // Input validation
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new Error("Invalid Date object");
  }

  if (startDate > endDate) {
    throw new Error("Start date must not be after end date");
  }

  // Read existing block numbers
  const existingData = fileManager.readBlockNumbers();
  const result: BlockNumberData = {
    metadata: { chain_id: CHAIN_IDS.ARBITRUM_ONE },
    blocks: { ...existingData.blocks },
  };

  // Get safe current block
  const safeCurrentBlock = await getSafeCurrentBlock(provider);

  // Handle empty date range
  if (startDate.getTime() === endDate.getTime()) {
    return result;
  }

  // Process each date in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = formatDateString(currentDate);

    // Skip if we already have this date
    if (result.blocks[dateStr]) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      continue;
    }

    // Skip if date is too recent
    const nextMidnight = new Date(currentDate);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    nextMidnight.setUTCHours(0, 0, 0, 0);

    const [lowerBound, upperBound] = getSearchBounds(
      currentDate,
      result,
      safeCurrentBlock,
    );

    // If upper bound is less than safe current block, the date is too recent
    if (upperBound > safeCurrentBlock) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      continue;
    }

    try {
      // Find the end-of-day block
      const blockNumber = await findEndOfDayBlock(
        currentDate,
        provider,
        lowerBound,
        upperBound,
      );
      result.blocks[dateStr] = blockNumber;

      // Save after each successful find
      fileManager.writeBlockNumbers(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Unable to find block")
      ) {
        throw error;
      }
      throw new Error(`Failed to find block for ${dateStr}: ${error}`);
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return result;
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

  const targetMidnight = new Date(date);
  targetMidnight.setUTCDate(targetMidnight.getUTCDate() + 1);
  targetMidnight.setUTCHours(0, 0, 0, 0);
  const targetTimestamp = Math.floor(targetMidnight.getTime() / 1000);

  let low = lowerBound;
  let high = upperBound;
  let lastValidBlock = -1;

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
        `  Lower block ${low} timestamp: ${new Date(lowerBlock.timestamp * 1000).toISOString()}`,
    );
  }

  const dateStart = new Date(date);
  dateStart.setUTCHours(0, 0, 0, 0);
  const dateStartTimestamp = Math.floor(dateStart.getTime() / 1000);

  if (upperBlock.timestamp < dateStartTimestamp) {
    throw new Error(
      `All blocks in range are before the target date\n` +
        `  Date: ${date.toISOString().split("T")[0]}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Upper block ${high} timestamp: ${new Date(upperBlock.timestamp * 1000).toISOString()}`,
    );
  }

  // Binary search
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

  if (lastValidBlock === -1) {
    throw new Error(
      `Unable to find block before midnight for ${date.toISOString().split("T")[0]}`,
    );
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
  const daysSinceLastBlock = lowerBound === 0 ? 365 : 1; // If no previous block, assume up to a year
  const estimatedBlocks = daysSinceLastBlock * BLOCKS_PER_DAY;
  const upperBound = Math.min(lowerBound + estimatedBlocks, safeCurrentBlock);

  // Ensure lower bound is at least 1 (block 0 is invalid)
  return [Math.max(1, lowerBound), upperBound];
}

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

function formatDateString(date: Date): DateString {
  return date.toISOString().split("T")[0]!;
}
