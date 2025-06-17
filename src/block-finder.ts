import { ethers } from "ethers";
import {
  BlockNumberData,
  DateString,
  FileManager,
  withRetry,
  RPCError,
  BlockFinderError,
} from "./types";

const FINALITY_BLOCKS = 1000;
const MILLISECONDS_PER_SECOND = 1000;
const MINIMUM_VALID_BLOCK = 1;

export class BlockFinder {
  constructor(
    private readonly fileManager: FileManager,
    private readonly provider: ethers.Provider,
  ) {}

  async findBlocksForDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<BlockNumberData> {
    validateDateRange(startDate, endDate);

    const result = await this.initializeResult();
    const safeCurrentBlock = await this.getSafeCurrentBlock();

    if (startDate.getTime() === endDate.getTime()) {
      return result;
    }

    for (const date of datesBetween(startDate, endDate)) {
      await this.processDate(date, result, safeCurrentBlock);
    }

    return result;
  }

  private async initializeResult(): Promise<BlockNumberData> {
    const existingData = this.fileManager.readBlockNumbers();

    let network: ethers.Network;
    try {
      network = await withRetry(() => this.provider.getNetwork(), {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      });
    } catch (error) {
      throw new RPCError(
        `Failed to get network information after 3 retries`,
        "getNetwork",
        3,
        error instanceof Error ? error : undefined,
      );
    }

    if (!existingData) {
      return {
        metadata: { chain_id: Number(network.chainId) },
        blocks: {},
      };
    }

    // Preserve existing metadata if it has data in blocks (indicating it's not just default)
    // Otherwise use chain ID from provider
    const metadata =
      Object.keys(existingData.blocks).length > 0
        ? existingData.metadata
        : { chain_id: Number(network.chainId) };

    return {
      metadata,
      blocks: { ...existingData.blocks },
    };
  }

  private async processDate(
    date: Date,
    result: BlockNumberData,
    safeCurrentBlock: number,
  ): Promise<void> {
    const dateStr = formatDateString(date);

    if (result.blocks[dateStr]) {
      return;
    }

    const [lowerBound, upperBound] = this.getSearchBounds(
      date,
      result,
      safeCurrentBlock,
    );

    if (upperBound > safeCurrentBlock) {
      return;
    }

    try {
      const blockNumber = await this.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );
      result.blocks[dateStr] = blockNumber;
      this.fileManager.writeBlockNumbers(result);
    } catch (error) {
      if (error instanceof BlockFinderError) {
        throw error;
      }
      const context: BlockFinderError["context"] = {
        date: dateStr,
        searchBounds: { lower: lowerBound, upper: upperBound },
      };
      if (error instanceof Error) {
        context.cause = error;
      }
      throw new BlockFinderError(
        `Failed to find end-of-day block for ${dateStr}`,
        "processDate",
        context,
      );
    }
  }

  async findEndOfDayBlock(
    date: Date,
    lowerBound: number,
    upperBound: number,
  ): Promise<number> {
    if (lowerBound > upperBound) {
      throw new BlockFinderError(
        `Invalid search bounds: lower bound is greater than upper bound\n` +
          `  Date: ${formatDateString(date)}\n` +
          `  Lower bound: ${lowerBound}\n` +
          `  Upper bound: ${upperBound}\n` +
          `  Check: Ensure safe current block (${upperBound}) is greater than most recent known block (${lowerBound})`,
        "findEndOfDayBlock",
        {
          date: formatDateString(date),
          searchBounds: { lower: lowerBound, upper: upperBound },
        },
      );
    }

    const targetTimestamp = toUnixTimestamp(getNextMidnight(date));
    const dateStartTimestamp = toUnixTimestamp(getMidnight(date));

    const [lowerBlock, upperBlock] = await Promise.all([
      withRetry(() => this.provider.getBlock(lowerBound), {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      }),
      withRetry(() => this.provider.getBlock(upperBound), {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      }),
    ]);

    if (!lowerBlock) {
      throw new BlockFinderError(
        `Block ${lowerBound} not found`,
        "findEndOfDayBlock",
        {
          date: formatDateString(date),
          searchBounds: { lower: lowerBound, upper: upperBound },
        },
      );
    }
    if (!upperBlock) {
      throw new BlockFinderError(
        `Block ${upperBound} not found`,
        "findEndOfDayBlock",
        {
          date: formatDateString(date),
          searchBounds: { lower: lowerBound, upper: upperBound },
        },
      );
    }

    validateBlockRange(
      date,
      lowerBlock,
      upperBlock,
      lowerBound,
      upperBound,
      targetTimestamp,
      dateStartTimestamp,
    );

    const lastValidBlock = await this.binarySearchForBlock(
      lowerBound,
      upperBound,
      targetTimestamp,
    );

    return lastValidBlock;
  }

  private async binarySearchForBlock(
    low: number,
    high: number,
    targetTimestamp: number,
  ): Promise<number> {
    let lastValidBlock = -1;
    let lastCheckedBlock: { number: number; timestamp: number } | undefined;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      let block: ethers.Block | null;
      try {
        block = await withRetry(() => this.provider.getBlock(mid), {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
        });
      } catch (error) {
        const context: BlockFinderError["context"] = {
          searchBounds: { lower: low, upper: high },
          targetTimestamp: fromUnixTimestamp(targetTimestamp),
        };
        if (lastCheckedBlock) {
          context.lastCheckedBlock = {
            number: lastCheckedBlock.number,
            timestamp: fromUnixTimestamp(lastCheckedBlock.timestamp),
          };
        }
        if (error instanceof Error) {
          context.cause = error;
        }
        throw new BlockFinderError(
          `Failed to get block ${mid} during binary search`,
          "binarySearchForBlock",
          context,
        );
      }

      if (!block) {
        const context: BlockFinderError["context"] = {
          searchBounds: { lower: low, upper: high },
          targetTimestamp: fromUnixTimestamp(targetTimestamp),
        };
        if (lastCheckedBlock) {
          context.lastCheckedBlock = {
            number: lastCheckedBlock.number,
            timestamp: fromUnixTimestamp(lastCheckedBlock.timestamp),
          };
        }
        throw new BlockFinderError(
          `Block ${mid} not found during search`,
          "binarySearchForBlock",
          context,
        );
      }

      lastCheckedBlock = { number: mid, timestamp: block.timestamp };

      if (block.timestamp < targetTimestamp) {
        lastValidBlock = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // If no valid block was found, all blocks are after midnight
    if (lastValidBlock === -1) {
      return low - 1;
    }

    return lastValidBlock;
  }

  async getSafeCurrentBlock(): Promise<number> {
    try {
      const currentBlock = await withRetry(
        () => this.provider.getBlockNumber(),
        {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
        },
      );
      return currentBlock - FINALITY_BLOCKS;
    } catch (error) {
      const rpcError = new RPCError(
        `Failed to get current block number after 3 retries`,
        "getBlockNumber",
        3,
        error instanceof Error ? error : undefined,
      );
      throw new BlockFinderError(
        `Failed to get current block number\n` +
          `  RPC request failed after ${rpcError.retryCount} retries\n` +
          `  Original error: ${rpcError.cause?.message || "Unknown error"}\n` +
          `  Check: Ensure RPC_URL is accessible and the provider is properly configured`,
        "getSafeCurrentBlock",
        { cause: rpcError },
      );
    }
  }

  getSearchBounds(
    date: Date,
    existingBlocks: BlockNumberData,
    safeCurrentBlock: number,
  ): [number, number] {
    const dateStr = formatDateString(date);
    const lowerBound = findMostRecentBlock(dateStr, existingBlocks);

    return [Math.max(MINIMUM_VALID_BLOCK, lowerBound), safeCurrentBlock];
  }
}

// Helper functions
function validateDateRange(startDate: Date, endDate: Date): void {
  if (!isValidDate(startDate)) {
    throw new BlockFinderError(
      `Invalid start date provided\n` +
        `  Value: ${startDate}\n` +
        `  Type: ${typeof startDate}\n` +
        `  Check: Ensure a valid Date object is provided`,
      "validateDateRange",
      {},
    );
  }

  if (!isValidDate(endDate)) {
    throw new BlockFinderError(
      `Invalid end date provided\n` +
        `  Value: ${endDate}\n` +
        `  Type: ${typeof endDate}\n` +
        `  Check: Ensure a valid Date object is provided`,
      "validateDateRange",
      {},
    );
  }

  if (startDate > endDate) {
    throw new BlockFinderError(
      `Start date must not be after end date\n` +
        `  Start date: ${startDate.toISOString()}\n` +
        `  End date: ${endDate.toISOString()}\n` +
        `  Check: Ensure date range is valid`,
      "validateDateRange",
      {},
    );
  }
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
    throw new BlockFinderError(
      `All blocks in range are after midnight\n` +
        `  Date: ${formatDateString(date)}\n` +
        `  Target: Before ${fromUnixTimestamp(targetTimestamp).toISOString()}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Lower block ${lowerBound} timestamp: ${fromUnixTimestamp(lowerBlock.timestamp).toISOString()}\n` +
        `  Check: Expand search bounds to include earlier blocks`,
      "validateBlockRange",
      {
        date: formatDateString(date),
        searchBounds: { lower: lowerBound, upper: upperBound },
        targetTimestamp: fromUnixTimestamp(targetTimestamp),
        lastCheckedBlock: {
          number: lowerBound,
          timestamp: fromUnixTimestamp(lowerBlock.timestamp),
        },
      },
    );
  }

  if (upperBlock.timestamp < dateStartTimestamp) {
    throw new BlockFinderError(
      `All blocks in range are before the target date\n` +
        `  Date: ${formatDateString(date)}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Upper block ${upperBound} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n` +
        `  Check: Ensure the date is valid and search bounds are correct`,
      "validateBlockRange",
      {
        date: formatDateString(date),
        searchBounds: { lower: lowerBound, upper: upperBound },
        lastCheckedBlock: {
          number: upperBound,
          timestamp: fromUnixTimestamp(upperBlock.timestamp),
        },
      },
    );
  }

  if (upperBlock.timestamp < targetTimestamp) {
    throw new BlockFinderError(
      `Search bounds do not contain midnight\n` +
        `  Date: ${formatDateString(date)}\n` +
        `  Target midnight: ${fromUnixTimestamp(targetTimestamp).toISOString()}\n` +
        `  Search bounds: ${lowerBound} to ${upperBound}\n` +
        `  Upper block ${upperBound} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n` +
        `  Upper bound needs to extend past midnight\n` +
        `  Check: Increase upper bound or wait for more blocks to be mined`,
      "validateBlockRange",
      {
        date: formatDateString(date),
        searchBounds: { lower: lowerBound, upper: upperBound },
        targetTimestamp: fromUnixTimestamp(targetTimestamp),
        lastCheckedBlock: {
          number: upperBound,
          timestamp: fromUnixTimestamp(upperBlock.timestamp),
        },
      },
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
