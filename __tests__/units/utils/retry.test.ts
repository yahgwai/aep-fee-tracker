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
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("retries operation 3 times by default on failure", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Attempt 1"))
        .mockRejectedValueOnce(new Error("Attempt 2"))
        .mockResolvedValueOnce("success on third try");

      const promise = withRetry(mockOperation);

      // Advance through retry delays
      await jest.advanceTimersByTimeAsync(1000); // First retry delay
      await jest.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await promise;
      expect(result).toBe("success on third try");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("throws error after 3 failed attempts", async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error("Operation failed"));

      const promise = withRetry(mockOperation);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Now the promise should reject
      await expect(promise).rejects.toThrow("Operation failed");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe("exponential backoff", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("applies exponential backoff delays between retries", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Attempt 1"))
        .mockRejectedValueOnce(new Error("Attempt 2"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockOperation);

      // First attempt - immediate
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Advance time by 1 second (first delay)
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Advance time by 2 seconds (second delay)
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockOperation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("does not apply delay after last failed attempt", async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Should throw after third attempt
      await expect(promise).rejects.toThrow("Always fails");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe("configurable options", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("respects custom retry count", async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation, { maxRetries: 5 });

      // Run all timers to completion
      await jest.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Always fails");
      expect(mockOperation).toHaveBeenCalledTimes(5);
    });

    it("respects custom initial delay", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockOperation, { initialDelay: 500 });

      // First attempt - immediate
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Advance time by 500ms (custom initial delay)
      await jest.advanceTimersByTimeAsync(500);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("respects custom backoff multiplier", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockOperation, {
        initialDelay: 100,
        backoffMultiplier: 3,
      });

      // First attempt - immediate
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Advance time by 100ms (first delay)
      await jest.advanceTimersByTimeAsync(100);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Advance time by 300ms (second delay = 100 * 3)
      await jest.advanceTimersByTimeAsync(300);
      expect(mockOperation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("uses all custom options together", async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation, {
        maxRetries: 2,
        initialDelay: 200,
        backoffMultiplier: 5,
      });

      // First attempt - immediate
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Advance time by 200ms (first delay)
      await jest.advanceTimersByTimeAsync(200);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Should fail after 2 attempts
      await expect(promise).rejects.toThrow("Always fails");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });
});
