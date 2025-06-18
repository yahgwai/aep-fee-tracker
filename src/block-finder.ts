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
    this.validateDateRange(startDate, endDate);

    const result = await this.initializeResult();
    const safeCurrentBlock = await this.getSafeCurrentBlock();

    if (startDate.getTime() === endDate.getTime()) {
      return result;
    }

    for (const date of this.datesBetween(startDate, endDate)) {
      await this.processDate(date, result, safeCurrentBlock);
    }

    return result;
  }

  private async initializeResult(): Promise<BlockNumberData> {
    const existingData = this.fileManager.readBlockNumbers();
    const network = await this.getNetwork();
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

  private async getNetwork(): Promise<ethers.Network> {
    try {
      return await withRetry(() => this.provider.getNetwork(), {
        ...RETRY_CONFIG,
        operationName: "getNetwork",
      });
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
    const dateStr = this.formatDateString(date);
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
        result,
      );
      result.blocks[dateStr] = blockNumber;
      this.fileManager.writeBlockNumbers(result);
    } catch (error) {
      if (error instanceof BlockFinderError) throw error;

      throw new BlockFinderError(
        `Failed to find end-of-day block for ${dateStr}`,
        "processDate",
        {
          date: dateStr,
          searchBounds: { lower: lowerBound, upper: upperBound },
          ...(error instanceof Error && { cause: error }),
        },
      );
    }
  }

  async findEndOfDayBlock(
    date: Date,
    lowerBound: number,
    upperBound: number,
    existingBlocks?: BlockNumberData,
  ): Promise<number> {
    if (lowerBound > upperBound) {
      throw new BlockFinderError(
        `Invalid search bounds: lower bound is greater than upper bound\n  Date: ${this.formatDateString(date)}\n  Lower bound: ${lowerBound}\n  Upper bound: ${upperBound}\n  Check: Ensure safe current block (${upperBound}) is greater than most recent known block (${lowerBound})`,
        "findEndOfDayBlock",
        {
          date: this.formatDateString(date),
          searchBounds: { lower: lowerBound, upper: upperBound },
        },
      );
    }

    const targetTimestamp = this.toUnixTimestamp(this.getNextMidnight(date));
    const dateStartTimestamp = this.toUnixTimestamp(this.getMidnight(date));

    // Check if the lower bound is a known end-of-day block
    const isLowerBoundKnown =
      existingBlocks &&
      Object.values(existingBlocks.blocks).includes(lowerBound);

    // Fetch upper block (always needed)
    const upperBlock = await withRetry(
      () => this.provider.getBlock(upperBound),
      {
        ...RETRY_CONFIG,
        operationName: `getBlock(${upperBound})`,
      },
    );

    const context = {
      date: this.formatDateString(date),
      searchBounds: { lower: lowerBound, upper: upperBound },
    };

    if (!upperBlock) {
      throw new BlockFinderError(
        `Block ${upperBound} not found`,
        "findEndOfDayBlock",
        context,
      );
    }

    // Only fetch and validate lower block if it's not a known end-of-day block
    if (!isLowerBoundKnown) {
      const lowerBlock = await withRetry(
        () => this.provider.getBlock(lowerBound),
        {
          ...RETRY_CONFIG,
          operationName: `getBlock(${lowerBound})`,
        },
      );

      if (!lowerBlock) {
        throw new BlockFinderError(
          `Block ${lowerBound} not found`,
          "findEndOfDayBlock",
          context,
        );
      }

      this.validateBlockRange(
        date,
        lowerBlock,
        upperBlock,
        lowerBound,
        upperBound,
        targetTimestamp,
        dateStartTimestamp,
      );
    } else {
      // For known blocks, we only need to validate that the upper block is after the target date start
      if (upperBlock.timestamp < dateStartTimestamp) {
        throw new BlockFinderError(
          `All blocks in range are before the target date\n  Date: ${this.formatDateString(date)}\n  Search bounds: ${lowerBound} to ${upperBound}\n  Upper block ${upperBound} timestamp: ${this.fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n  Check: Ensure the date is valid and search bounds are correct`,
          "validateBlockRange",
          {
            date: this.formatDateString(date),
            searchBounds: { lower: lowerBound, upper: upperBound },
            lastCheckedBlock: {
              number: upperBound,
              timestamp: this.fromUnixTimestamp(upperBlock.timestamp),
            },
          },
        );
      }

      // Check upper bound contains midnight
      if (upperBlock.timestamp < targetTimestamp) {
        throw new BlockFinderError(
          `Search bounds do not contain midnight\n  Date: ${this.formatDateString(date)}\n  Search bounds: ${lowerBound} to ${upperBound}\n  Target midnight: ${this.fromUnixTimestamp(targetTimestamp).toISOString()}\n  Upper block ${upperBound} timestamp: ${this.fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n  Upper bound needs to extend past midnight\n  Check: Increase upper bound or wait for more blocks to be mined`,
          "validateBlockRange",
          {
            date: this.formatDateString(date),
            searchBounds: { lower: lowerBound, upper: upperBound },
            lastCheckedBlock: {
              number: upperBound,
              timestamp: this.fromUnixTimestamp(upperBlock.timestamp),
            },
            targetTimestamp: this.fromUnixTimestamp(targetTimestamp),
          },
        );
      }
    }

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
      const block = await withRetry(() => this.provider.getBlock(blockNumber), {
        ...RETRY_CONFIG,
        operationName: `getBlock(${blockNumber})`,
      });
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

      throw new BlockFinderError(
        `Failed to get block ${blockNumber} during binary search`,
        "binarySearchForBlock",
        { ...context, ...(error instanceof Error && { cause: error }) },
      );
    }
  }

  private createSearchContext(
    low: number,
    high: number,
    targetTimestamp: number,
    lastCheckedBlock?: { number: number; timestamp: number },
  ): BlockFinderError["context"] {
    return {
      searchBounds: { lower: low, upper: high },
      targetTimestamp: this.fromUnixTimestamp(targetTimestamp),
      ...(lastCheckedBlock && {
        lastCheckedBlock: {
          number: lastCheckedBlock.number,
          timestamp: this.fromUnixTimestamp(lastCheckedBlock.timestamp),
        },
      }),
    };
  }

  async getSafeCurrentBlock(): Promise<number> {
    try {
      const currentBlock = await withRetry(
        () => this.provider.getBlockNumber(),
        {
          ...RETRY_CONFIG,
          operationName: "getBlockNumber",
        },
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
    return `Failed to get current block number\n  RPC request failed after ${rpcError.retryCount} retries\n  Original error: ${rpcError.cause?.message || "Unknown error"}\n  Check: Ensure RPC_URL is accessible and the provider is properly configured`;
  }

  getSearchBounds(
    date: Date,
    existingBlocks: BlockNumberData,
    safeCurrentBlock: number,
  ): [number, number] {
    const dateStr = this.formatDateString(date);
    const lowerBound = this.findMostRecentBlock(dateStr, existingBlocks);

    return [Math.max(MINIMUM_VALID_BLOCK, lowerBound), safeCurrentBlock];
  }

  // Find the most recent known block before the target date
  private findMostRecentBlock(
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

  private validateDateRange(startDate: Date, endDate: Date): void {
    const isValidDate = (date: unknown): date is Date => {
      return date instanceof Date && !isNaN(date.getTime());
    };

    if (!isValidDate(startDate)) {
      throw new BlockFinderError(
        `Invalid start date provided\n  Value: ${startDate}\n  Type: ${typeof startDate}\n  Check: Ensure a valid Date object is provided`,
        "validateDateRange",
        {},
      );
    }

    if (!isValidDate(endDate)) {
      throw new BlockFinderError(
        `Invalid end date provided\n  Value: ${endDate}\n  Type: ${typeof endDate}\n  Check: Ensure a valid Date object is provided`,
        "validateDateRange",
        {},
      );
    }

    if (startDate > endDate) {
      throw new BlockFinderError(
        `Start date must not be after end date\n  Start date: ${startDate.toISOString()}\n  End date: ${endDate.toISOString()}\n  Check: Ensure date range is valid`,
        "validateDateRange",
        {},
      );
    }
  }

  private formatDateString(date: Date): DateString {
    return date.toISOString().split("T")[0]!;
  }

  private getNextMidnight(date: Date): Date {
    const midnight = new Date(date);
    midnight.setUTCDate(midnight.getUTCDate() + 1);
    midnight.setUTCHours(0, 0, 0, 0);
    return midnight;
  }

  private getMidnight(date: Date): Date {
    const midnight = new Date(date);
    midnight.setUTCHours(0, 0, 0, 0);
    return midnight;
  }

  private toUnixTimestamp(date: Date): number {
    return Math.floor(date.getTime() / MILLISECONDS_PER_SECOND);
  }

  private fromUnixTimestamp(timestamp: number): Date {
    return new Date(timestamp * MILLISECONDS_PER_SECOND);
  }

  private *datesBetween(start: Date, end: Date): Generator<Date> {
    const current = new Date(start);
    while (current <= end) {
      yield new Date(current);
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  private validateBlockRange(
    date: Date,
    lowerBlock: ethers.Block,
    upperBlock: ethers.Block,
    lowerBound: number,
    upperBound: number,
    targetTimestamp: number,
    dateStartTimestamp: number,
  ): void {
    const dateStr = this.formatDateString(date);
    const bounds = { lower: lowerBound, upper: upperBound };

    if (lowerBlock.timestamp >= targetTimestamp) {
      const context: BlockFinderError["context"] = {
        date: dateStr,
        searchBounds: bounds,
        lastCheckedBlock: {
          number: lowerBound,
          timestamp: this.fromUnixTimestamp(lowerBlock.timestamp),
        },
        targetTimestamp: this.fromUnixTimestamp(targetTimestamp),
      };

      throw new BlockFinderError(
        `All blocks in range are after midnight\n  Date: ${dateStr}\n  Search bounds: ${bounds.lower} to ${bounds.upper}\n  Target: Before ${this.fromUnixTimestamp(targetTimestamp).toISOString()}\n  Lower block ${lowerBound} timestamp: ${this.fromUnixTimestamp(lowerBlock.timestamp).toISOString()}\n  Check: Expand search bounds to include earlier blocks`,
        "validateBlockRange",
        context,
      );
    }

    if (upperBlock.timestamp < dateStartTimestamp) {
      const context: BlockFinderError["context"] = {
        date: dateStr,
        searchBounds: bounds,
        lastCheckedBlock: {
          number: upperBound,
          timestamp: this.fromUnixTimestamp(upperBlock.timestamp),
        },
      };

      throw new BlockFinderError(
        `All blocks in range are before the target date\n  Date: ${dateStr}\n  Search bounds: ${bounds.lower} to ${bounds.upper}\n  Upper block ${upperBound} timestamp: ${this.fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n  Check: Ensure the date is valid and search bounds are correct`,
        "validateBlockRange",
        context,
      );
    }

    if (upperBlock.timestamp < targetTimestamp) {
      const context: BlockFinderError["context"] = {
        date: dateStr,
        searchBounds: bounds,
        lastCheckedBlock: {
          number: upperBound,
          timestamp: this.fromUnixTimestamp(upperBlock.timestamp),
        },
        targetTimestamp: this.fromUnixTimestamp(targetTimestamp),
      };

      throw new BlockFinderError(
        `Search bounds do not contain midnight\n  Date: ${dateStr}\n  Search bounds: ${bounds.lower} to ${bounds.upper}\n  Target midnight: ${this.fromUnixTimestamp(targetTimestamp).toISOString()}\n  Upper block ${upperBound} timestamp: ${this.fromUnixTimestamp(upperBlock.timestamp).toISOString()}\n  Upper bound needs to extend past midnight\n  Check: Increase upper bound or wait for more blocks to be mined`,
        "validateBlockRange",
        context,
      );
    }
  }
}
