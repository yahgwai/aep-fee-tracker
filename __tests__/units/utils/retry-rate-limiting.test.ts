import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { withRetry, RetryOptions } from "../../../src/utils/retry";

interface ExtendedRetryOptions extends RetryOptions {
  rateLimitDelay?: number;
}

describe("Retry with HTTP 429 Rate Limiting", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it("applies longer delay for HTTP 429 errors", async () => {
    const http429Error = new Error("Request failed with status code 429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      backoffMultiplier: 2,
      rateLimitDelay: 5000,
    } as ExtendedRetryOptions);

    // First attempt fails immediately
    expect(mockCall).toHaveBeenCalledTimes(1);

    // Advance timer by rate limit delay
    await jest.advanceTimersByTimeAsync(5000);

    await promise;
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("detects HTTP 429 in error message", async () => {
    const rateLimitError = new Error("Too Many Requests - 429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 3000,
    } as ExtendedRetryOptions);

    // Advance timer by rate limit delay
    await jest.advanceTimersByTimeAsync(3000);

    await promise;
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("uses normal delay for non-429 errors", async () => {
    const normalError = new Error("Network timeout");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(normalError)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 5000,
    } as ExtendedRetryOptions);

    // Advance timer by normal delay (not rate limit delay)
    await jest.advanceTimersByTimeAsync(100);

    await promise;
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("logs rate limiting detection when operation name is provided", async () => {
    const http429Error = new Error("429 Rate Limit Exceeded");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 100,
      operationName: "getBlock",
    } as ExtendedRetryOptions);

    // Advance timer
    await jest.advanceTimersByTimeAsync(100);

    await promise;
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Rate limit detected for getBlock, using longer delay",
      ),
    );
  });

  it("applies rate limit delay multiple times", async () => {
    const http429Error = new Error("429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      rateLimitDelay: 1000,
    } as ExtendedRetryOptions);

    // First retry after rate limit delay
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockCall).toHaveBeenCalledTimes(2);

    // Second retry after another rate limit delay
    await jest.advanceTimersByTimeAsync(1000);

    await promise;
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("defaults to 30 second rate limit delay when not specified", async () => {
    const http429Error = new Error("429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const promise = withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
    } as ExtendedRetryOptions);

    // Advance timer by default rate limit delay (30 seconds)
    await jest.advanceTimersByTimeAsync(30000);

    await promise;
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
