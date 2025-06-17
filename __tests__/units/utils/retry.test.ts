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
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Operation failed"));

      const promise = withRetry(mockOperation).catch((e) => e);

      // Run through all retry attempts
      await jest.advanceTimersByTimeAsync(1000); // First retry
      await jest.advanceTimersByTimeAsync(2000); // Second retry

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Operation failed");
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
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation).catch((e) => e);

      // Run through all retry attempts
      await jest.advanceTimersByTimeAsync(1000); // First retry
      await jest.advanceTimersByTimeAsync(2000); // Second retry

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Always fails");
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
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation, { maxRetries: 5 }).catch(
        (e) => e,
      );

      // Run through all 5 retry attempts
      await jest.advanceTimersByTimeAsync(1000); // 1st retry
      await jest.advanceTimersByTimeAsync(2000); // 2nd retry
      await jest.advanceTimersByTimeAsync(4000); // 3rd retry
      await jest.advanceTimersByTimeAsync(8000); // 4th retry

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Always fails");
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
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Always fails"));

      const promise = withRetry(mockOperation, {
        maxRetries: 2,
        initialDelay: 200,
        backoffMultiplier: 5,
      }).catch((e) => e);

      // First attempt - immediate
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Run through retry with custom delay
      await jest.advanceTimersByTimeAsync(200); // First retry (200ms)

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Always fails");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe("error filtering", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("retries only on errors that match the filter", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Transient error"))
        .mockRejectedValueOnce(new Error("Another transient"))
        .mockResolvedValueOnce("success");

      const shouldRetry = (error: Error) =>
        error.message.toLowerCase().includes("transient");

      const promise = withRetry(mockOperation, { shouldRetry });

      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("does not retry on errors that do not match the filter", async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error("Permanent failure"));

      const shouldRetry = (error: Error) => error.message.includes("transient");

      const promise = withRetry(mockOperation, { shouldRetry });

      await expect(promise).rejects.toThrow("Permanent failure");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("stops retrying when encountering non-retryable error", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Transient error"))
        .mockRejectedValueOnce(new Error("Fatal error"))
        .mockResolvedValueOnce("should not reach");

      const shouldRetry = (error: Error) => !error.message.includes("Fatal");

      const promise = withRetry(mockOperation, { shouldRetry }).catch((e) => e);

      // First attempt - immediate, fails with "Transient error"
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Run timer for first retry
      await jest.advanceTimersByTimeAsync(1000);

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Fatal error");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("combines error filtering with custom retry options", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error("Retry this"))
        .mockRejectedValueOnce(new Error("Retry this too"))
        .mockResolvedValueOnce("success");

      const shouldRetry = (error: Error) => error.message.includes("Retry");

      const promise = withRetry(mockOperation, {
        shouldRetry,
        maxRetries: 5,
        initialDelay: 100,
      });

      // First retry after 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Second retry after 200ms (100 * 2)
      await jest.advanceTimersByTimeAsync(200);
      expect(mockOperation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });
  });
});
