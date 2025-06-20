export interface BlockRangeChunk {
  fromBlock: number;
  toBlock: number;
}

export function chunkBlockRange(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
): BlockRangeChunk[] {
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
