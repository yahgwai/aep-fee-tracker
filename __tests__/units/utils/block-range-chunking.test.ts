import { chunkBlockRange } from "../../../src/utils/block-range-chunking";

describe("chunkBlockRange", () => {
  it("returns single chunk when range fits within chunk size", () => {
    const result = chunkBlockRange(100, 199, 1000);

    expect(result).toEqual([{ fromBlock: 100, toBlock: 199 }]);
  });

  it("splits range into multiple chunks when exceeding chunk size", () => {
    const result = chunkBlockRange(100, 299, 100);

    expect(result).toEqual([
      { fromBlock: 100, toBlock: 199 },
      { fromBlock: 200, toBlock: 299 },
    ]);
  });
});
