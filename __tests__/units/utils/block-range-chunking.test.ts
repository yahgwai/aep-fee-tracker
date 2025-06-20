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

  it("throws error when fromBlock is greater than toBlock", () => {
    expect(() => chunkBlockRange(200, 100, 50)).toThrow(
      "Invalid block range: fromBlock (200) must be less than or equal to toBlock (100)"
    );
  });
});
