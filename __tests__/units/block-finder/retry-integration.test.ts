import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { withRetry } from "../../../src/types";

describe("Retry Integration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });
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

    const promise = withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });

    // Advance through retry delays
    await jest.advanceTimersByTimeAsync(100); // First retry
    await jest.advanceTimersByTimeAsync(200); // Second retry

    const result = await promise;
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

    const promise = withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    }).catch((e) => e);

    // Advance through retry delays
    await jest.advanceTimersByTimeAsync(100); // First retry
    await jest.advanceTimersByTimeAsync(200); // Second retry

    const error = await promise;
    expect(error).toBe(lastError);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff between retries", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"))
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
    });

    // First attempt is immediate
    expect(mockCall).toHaveBeenCalledTimes(1);

    // Advance by 100ms for first retry
    await jest.advanceTimersByTimeAsync(100);
    expect(mockCall).toHaveBeenCalledTimes(2);

    // Advance by 200ms for second retry (exponential backoff)
    await jest.advanceTimersByTimeAsync(200);
    expect(mockCall).toHaveBeenCalledTimes(3);

    await promise;
  });

  it("respects shouldRetry predicate", async () => {
    const retryableError = new Error("Retry me");
    const nonRetryableError = new Error("Do not retry");

    const mockCall = jest
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(nonRetryableError);

    const promise = withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      shouldRetry: (error) => error.message !== "Do not retry",
    }).catch((e) => e);

    // First attempt fails with retryable error
    expect(mockCall).toHaveBeenCalledTimes(1);

    // Advance timer for retry
    await jest.advanceTimersByTimeAsync(100);

    const error = await promise;
    expect(error).toBe(nonRetryableError);
    // Should stop after second attempt due to shouldRetry returning false
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
