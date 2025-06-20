import { chunkBlockRange } from "../../../src/utils/block-range-chunking";

describe("chunkBlockRange", () => {
  it("returns single chunk when range fits within chunk size", () => {
    const result = chunkBlockRange(100, 199, 1000);
    
    expect(result).toEqual([
      { fromBlock: 100, toBlock: 199 }
    ]);
  });
});