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
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
};

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
    const network = await this.getNetworkWithRetry();
    const chainId = Number(network.chainId);

    if (!existingData) {
      return { metadata: { chain_id: chainId }, blocks: {} };
    }

    const hasData = Object.keys(existingData.blocks).length > 0;
    return {
      metadata: hasData ? existingData.metadata : { chain_id: chainId },
      blocks: { ...existingData.blocks },
    };
  }

  private async getNetworkWithRetry(): Promise<ethers.Network> {
    try {
      return await withRetry(() => this.provider.getNetwork(), RETRY_CONFIG);
    } catch (error) {
      throw new RPCError(
        `Failed to get network information after ${RETRY_CONFIG.maxRetries} retries`,
        "getNetwork",
        RETRY_CONFIG.maxRetries,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async processDate(
    date: Date,
    result: BlockNumberData,
    safeCurrentBlock: number,
  ): Promise<void> {
    const dateStr = formatDateString(date);
    if (result.blocks[dateStr]) return;

    const [lowerBound, upperBound] = this.getSearchBounds(
      date,
      result,
      safeCurrentBlock,
    );

    if (upperBound > safeCurrentBlock) return;

    try {
      const blockNumber = await this.findEndOfDayBlock(
        date,
        lowerBound,
        upperBound,
      );
      result.blocks[dateStr] = blockNumber;
      this.fileManager.writeBlockNumbers(result);
    } catch (error) {
      if (error instanceof BlockFinderError) throw error;

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
        formatErrorMessage(
          "Invalid search bounds: lower bound is greater than upper bound",
          [
            `Date: ${formatDateString(date)}`,
            `Lower bound: ${lowerBound}`,
            `Upper bound: ${upperBound}`,
          ],
          `Ensure safe current block (${upperBound}) is greater than most recent known block (${lowerBound})`,
        ),
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
      withRetry(() => this.provider.getBlock(lowerBound), RETRY_CONFIG),
      withRetry(() => this.provider.getBlock(upperBound), RETRY_CONFIG),
    ]);

    const context = {
      date: formatDateString(date),
      searchBounds: { lower: lowerBound, upper: upperBound },
    };

    if (!lowerBlock) {
      throw new BlockFinderError(
        `Block ${lowerBound} not found`,
        "findEndOfDayBlock",
        context,
      );
    }
    if (!upperBlock) {
      throw new BlockFinderError(
        `Block ${upperBound} not found`,
        "findEndOfDayBlock",
        context,
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
      const block = await this.getBlockForSearch(
        mid,
        low,
        high,
        targetTimestamp,
        lastCheckedBlock,
      );

      lastCheckedBlock = { number: mid, timestamp: block.timestamp };

      if (block.timestamp < targetTimestamp) {
        lastValidBlock = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return lastValidBlock === -1 ? low - 1 : lastValidBlock;
  }

  private async getBlockForSearch(
    blockNumber: number,
    low: number,
    high: number,
    targetTimestamp: number,
    lastCheckedBlock?: { number: number; timestamp: number },
  ): Promise<ethers.Block> {
    const context = this.createSearchContext(
      low,
      high,
      targetTimestamp,
      lastCheckedBlock,
    );

    try {
      const block = await withRetry(
        () => this.provider.getBlock(blockNumber),
        RETRY_CONFIG,
      );
      if (!block) {
        throw new BlockFinderError(
          `Block ${blockNumber} not found during search`,
          "binarySearchForBlock",
          context,
        );
      }
      return block;
    } catch (error) {
      if (error instanceof BlockFinderError) throw error;
      if (error instanceof Error) {
        context.cause = error;
      }
      throw new BlockFinderError(
        `Failed to get block ${blockNumber} during binary search`,
        "binarySearchForBlock",
        context,
      );
    }
  }

  private createSearchContext(
    low: number,
    high: number,
    targetTimestamp: number,
    lastCheckedBlock?: { number: number; timestamp: number },
  ): BlockFinderError["context"] {
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
    return context;
  }

  async getSafeCurrentBlock(): Promise<number> {
    try {
      const currentBlock = await withRetry(
        () => this.provider.getBlockNumber(),
        RETRY_CONFIG,
      );
      return currentBlock - FINALITY_BLOCKS;
    } catch (error) {
      const rpcError = new RPCError(
        `Failed to get current block number after ${RETRY_CONFIG.maxRetries} retries`,
        "getBlockNumber",
        RETRY_CONFIG.maxRetries,
        error instanceof Error ? error : undefined,
      );
      throw new BlockFinderError(
        this.formatRPCError(rpcError),
        "getSafeCurrentBlock",
        { cause: rpcError },
      );
    }
  }

  private formatRPCError(rpcError: RPCError): string {
    return [
      `Failed to get current block number`,
      `  RPC request failed after ${rpcError.retryCount} retries`,
      `  Original error: ${rpcError.cause?.message || "Unknown error"}`,
      `  Check: Ensure RPC_URL is accessible and the provider is properly configured`,
    ].join("\n");
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
    throw createInvalidDateError("start", startDate);
  }
  if (!isValidDate(endDate)) {
    throw createInvalidDateError("end", endDate);
  }
  if (startDate > endDate) {
    throw new BlockFinderError(
      formatErrorMessage(
        "Start date must not be after end date",
        [
          `Start date: ${startDate.toISOString()}`,
          `End date: ${endDate.toISOString()}`,
        ],
        "Ensure date range is valid",
      ),
      "validateDateRange",
      {},
    );
  }
}

function createInvalidDateError(type: string, date: unknown): BlockFinderError {
  return new BlockFinderError(
    formatErrorMessage(
      `Invalid ${type} date provided`,
      [`Value: ${date}`, `Type: ${typeof date}`],
      "Ensure a valid Date object is provided",
    ),
    "validateDateRange",
    {},
  );
}

function formatErrorMessage(
  message: string,
  details: string[],
  check?: string,
): string {
  const parts = [message, ...details.map((d) => `  ${d}`)];
  if (check) parts.push(`  Check: ${check}`);
  return parts.join("\n");
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
  const dateStr = formatDateString(date);
  const bounds = { lower: lowerBound, upper: upperBound };

  if (lowerBlock.timestamp >= targetTimestamp) {
    throw createBlockRangeError(
      "All blocks in range are after midnight",
      dateStr,
      bounds,
      [
        `Target: Before ${fromUnixTimestamp(targetTimestamp).toISOString()}`,
        `Lower block ${lowerBound} timestamp: ${fromUnixTimestamp(lowerBlock.timestamp).toISOString()}`,
      ],
      "Expand search bounds to include earlier blocks",
      lowerBound,
      lowerBlock.timestamp,
      targetTimestamp,
    );
  }

  if (upperBlock.timestamp < dateStartTimestamp) {
    throw createBlockRangeError(
      "All blocks in range are before the target date",
      dateStr,
      bounds,
      [
        `Upper block ${upperBound} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}`,
      ],
      "Ensure the date is valid and search bounds are correct",
      upperBound,
      upperBlock.timestamp,
    );
  }

  if (upperBlock.timestamp < targetTimestamp) {
    throw createBlockRangeError(
      "Search bounds do not contain midnight",
      dateStr,
      bounds,
      [
        `Target midnight: ${fromUnixTimestamp(targetTimestamp).toISOString()}`,
        `Upper block ${upperBound} timestamp: ${fromUnixTimestamp(upperBlock.timestamp).toISOString()}`,
        `Upper bound needs to extend past midnight`,
      ],
      "Increase upper bound or wait for more blocks to be mined",
      upperBound,
      upperBlock.timestamp,
      targetTimestamp,
    );
  }
}

function createBlockRangeError(
  message: string,
  date: string,
  bounds: { lower: number; upper: number },
  details: string[],
  check: string,
  blockNumber: number,
  blockTimestamp: number,
  targetTimestamp?: number,
): BlockFinderError {
  const context: BlockFinderError["context"] = {
    date,
    searchBounds: bounds,
    lastCheckedBlock: {
      number: blockNumber,
      timestamp: fromUnixTimestamp(blockTimestamp),
    },
  };
  if (targetTimestamp !== undefined) {
    context.targetTimestamp = fromUnixTimestamp(targetTimestamp);
  }

  return new BlockFinderError(
    formatErrorMessage(
      message,
      [
        `Date: ${date}`,
        `Search bounds: ${bounds.lower} to ${bounds.upper}`,
        ...details,
      ],
      check,
    ),
    "validateBlockRange",
    context,
  );
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
