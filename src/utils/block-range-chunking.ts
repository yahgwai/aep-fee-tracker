export function chunkBlockRange(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
) {
  void chunkSize; // Acknowledge parameter exists
  return [{ fromBlock, toBlock }];
}
