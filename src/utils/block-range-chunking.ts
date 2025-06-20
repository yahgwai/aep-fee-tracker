export interface BlockRangeChunk {
  fromBlock: number;
  toBlock: number;
}

export function chunkBlockRange(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
): BlockRangeChunk[] {
  if (chunkSize <= 0) {
    throw new Error("Invalid chunk size: must be greater than 0");
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
