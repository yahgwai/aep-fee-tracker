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
      "Invalid block range: fromBlock (200) must be less than or equal to toBlock (100)",
    );
  });

  it("throws error when chunk size is zero", () => {
    expect(() => chunkBlockRange(100, 200, 0)).toThrow(
      "Invalid chunk size: must be greater than 0",
    );
  });

  it("handles single block range", () => {
    const result = chunkBlockRange(100, 100, 1000);

    expect(result).toEqual([{ fromBlock: 100, toBlock: 100 }]);
  });

  it("handles non-divisible ranges", () => {
    const result = chunkBlockRange(0, 250, 100);

    expect(result).toEqual([
      { fromBlock: 0, toBlock: 99 },
      { fromBlock: 100, toBlock: 199 },
      { fromBlock: 200, toBlock: 250 },
    ]);
  });

  it("throws error when block numbers are negative", () => {
    expect(() => chunkBlockRange(-10, 100, 50)).toThrow(
      "Invalid block range: block numbers must be non-negative",
    );
  });
});
