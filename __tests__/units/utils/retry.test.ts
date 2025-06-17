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

  describe("retry behavior", () => {
    it("retries operation 3 times by default on failure", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Attempt 1"))
        .mockRejectedValueOnce(new Error("Attempt 2"))
        .mockResolvedValueOnce("success on third try");

      const result = await withRetry(mockOperation);

      expect(result).toBe("success on third try");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("throws error after 3 failed attempts", async () => {
      const error = new Error("Operation failed");
      const mockOperation = jest.fn().mockRejectedValue(error);

      await expect(withRetry(mockOperation)).rejects.toThrow(
        "Operation failed",
      );
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
});
