export interface BlockRangeChunk {
  fromBlock: number;
  toBlock: number;
}

export function chunkBlockRange(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
): BlockRangeChunk[] {
  void chunkSize; // Acknowledge parameter exists
  return [{ fromBlock, toBlock }];
}
