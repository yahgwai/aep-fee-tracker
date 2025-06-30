import { SAFE_BLOCK_OFFSET } from "../../../src/constants";

describe("Constants", () => {
  describe("SAFE_BLOCK_OFFSET", () => {
    it("should have correct value of 100", () => {
      expect(SAFE_BLOCK_OFFSET).toBe(100);
    });

    it("should be a number", () => {
      expect(typeof SAFE_BLOCK_OFFSET).toBe("number");
    });

    it("should be positive", () => {
      expect(SAFE_BLOCK_OFFSET).toBeGreaterThan(0);
    });
  });
});
