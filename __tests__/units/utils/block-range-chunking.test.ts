import { chunkBlockRange } from "../../../src/utils/block-range-chunking";

describe("chunkBlockRange", () => {
  describe("when block range fits within chunk size", () => {
    it("returns single chunk with full range", () => {
      const result = chunkBlockRange(100, 199, 1000);

      expect(result).toEqual([{ fromBlock: 100, toBlock: 199 }]);
    });

    it("handles single block range", () => {
      const result = chunkBlockRange(100, 100, 1000);

      expect(result).toEqual([{ fromBlock: 100, toBlock: 100 }]);
    });

    it("handles exact chunk size", () => {
      const result = chunkBlockRange(100, 199, 100);

      expect(result).toEqual([{ fromBlock: 100, toBlock: 199 }]);
    });
  });

  describe("when block range exceeds chunk size", () => {
    it("splits range into multiple chunks", () => {
      const result = chunkBlockRange(100, 349, 100);

      expect(result).toEqual([
        { fromBlock: 100, toBlock: 199 },
        { fromBlock: 200, toBlock: 299 },
        { fromBlock: 300, toBlock: 349 },
      ]);
    });

    it("handles non-divisible ranges", () => {
      const result = chunkBlockRange(0, 250, 100);

      expect(result).toEqual([
        { fromBlock: 0, toBlock: 99 },
        { fromBlock: 100, toBlock: 199 },
        { fromBlock: 200, toBlock: 250 },
      ]);
    });

    it("handles large ranges efficiently", () => {
      const result = chunkBlockRange(1000000, 1050000, 10000);

      expect(result).toHaveLength(6);
      expect(result[0]).toEqual({ fromBlock: 1000000, toBlock: 1009999 });
      expect(result[5]).toEqual({ fromBlock: 1050000, toBlock: 1050000 });
    });
  });

  describe("edge cases", () => {
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

    it("throws error when chunk size is negative", () => {
      expect(() => chunkBlockRange(100, 200, -10)).toThrow(
        "Invalid chunk size: must be greater than 0",
      );
    });

    it("throws error when block numbers are negative", () => {
      expect(() => chunkBlockRange(-10, 100, 50)).toThrow(
        "Invalid block range: block numbers must be non-negative",
      );
    });
  });

  describe("type safety", () => {
    it("returns properly typed chunk objects", () => {
      const result = chunkBlockRange(100, 200, 50);

      result.forEach((chunk) => {
        expect(typeof chunk.fromBlock).toBe("number");
        expect(typeof chunk.toBlock).toBe("number");
        expect(chunk.fromBlock).toBeLessThanOrEqual(chunk.toBlock);
      });
    });
  });
});
