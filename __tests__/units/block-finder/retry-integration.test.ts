import { describe, it, expect, jest } from "@jest/globals";
import { withRetry } from "../../../src/types";

describe("Retry Integration", () => {
  it("returns result on first successful call", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockResolvedValue({ number: 100 });

    const result = await withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });

    expect(result).toEqual({ number: 100 });
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries times on failure", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({ number: 100 });

    const result = await withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });

    expect(result).toEqual({ number: 100 });
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("throws last error after maxRetries failed attempts", async () => {
    const lastError = new Error("Connection refused");
    const mockCall = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Error 1"))
      .mockRejectedValue(new Error("Error 2"))
      .mockRejectedValue(lastError);

    await expect(
      withRetry(mockCall, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      }),
    ).rejects.toThrow(lastError);

    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff between retries", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"))
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });
    const duration = Date.now() - startTime;

    // Should take at least 300ms (100ms + 200ms delays)
    expect(duration).toBeGreaterThanOrEqual(300);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("respects shouldRetry predicate", async () => {
    const retryableError = new Error("Retry me");
    const nonRetryableError = new Error("Do not retry");

    const mockCall = jest
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(nonRetryableError);

    await expect(
      withRetry(mockCall, {
        maxRetries: 3,
        initialDelay: 100,
        shouldRetry: (error) => error.message !== "Do not retry",
      }),
    ).rejects.toThrow(nonRetryableError);

    // Should stop after second attempt due to shouldRetry returning false
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
