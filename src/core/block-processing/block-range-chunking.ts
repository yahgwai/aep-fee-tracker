/**
 * Represents a chunk of block range
 */
export interface BlockRangeChunk {
  fromBlock: number;
  toBlock: number;
}

/**
 * Splits a block range into smaller chunks for processing.
 * This is useful when dealing with RPC providers that have limits on block range queries.
 *
 * @param fromBlock - Starting block number (inclusive)
 * @param toBlock - Ending block number (inclusive)
 * @param chunkSize - Maximum number of blocks per chunk
 * @returns Array of block range chunks
 * @throws Error if parameters are invalid
 */
export function chunkBlockRange(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
): BlockRangeChunk[] {
  if (chunkSize <= 0) {
    throw new Error("Invalid chunk size: must be greater than 0");
  }

  if (fromBlock < 0 || toBlock < 0) {
    throw new Error("Invalid block range: block numbers must be non-negative");
  }

  if (fromBlock > toBlock) {
    throw new Error(
      `Invalid block range: fromBlock (${fromBlock}) must be less than or equal to toBlock (${toBlock})`,
    );
  }

  const chunks: BlockRangeChunk[] = [];
  let currentBlock = fromBlock;

  while (currentBlock <= toBlock) {
    const endBlock = Math.min(currentBlock + chunkSize - 1, toBlock);
    chunks.push({
      fromBlock: currentBlock,
      toBlock: endBlock,
    });
    currentBlock = endBlock + 1;
  }

  return chunks;
}
