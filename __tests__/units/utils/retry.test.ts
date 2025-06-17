import { withRetry } from "../../../src/utils/retry";

describe("withRetry", () => {
  describe("successful operations", () => {
    it("returns result immediately when operation succeeds", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      const result = await withRetry(mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});
