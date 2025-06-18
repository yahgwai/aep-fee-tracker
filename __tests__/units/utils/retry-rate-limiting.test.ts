import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { withRetry, RetryOptions } from "../../../src/utils/retry";

interface ExtendedRetryOptions extends RetryOptions {
  rateLimitDelay?: number;
}

describe("Retry with HTTP 429 Rate Limiting", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("applies longer delay for HTTP 429 errors", async () => {
    const http429Error = new Error("Request failed with status code 429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      backoffMultiplier: 2,
      rateLimitDelay: 5000,
    } as ExtendedRetryOptions);
    const duration = Date.now() - startTime;

    // Should take at least 5000ms due to rate limit delay
    expect(duration).toBeGreaterThanOrEqual(5000);
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("detects HTTP 429 in error message", async () => {
    const rateLimitError = new Error("Too Many Requests - 429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 3000,
    } as ExtendedRetryOptions);
    const duration = Date.now() - startTime;

    // Should use rate limit delay
    expect(duration).toBeGreaterThanOrEqual(3000);
  });

  it("uses normal delay for non-429 errors", async () => {
    const normalError = new Error("Network timeout");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(normalError)
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 5000,
    } as ExtendedRetryOptions);
    const duration = Date.now() - startTime;

    // Should use normal delay (100ms), not rate limit delay
    expect(duration).toBeLessThan(1000);
    expect(duration).toBeGreaterThanOrEqual(100);
  });

  it("logs rate limiting detection when operation name is provided", async () => {
    const http429Error = new Error("429 Rate Limit Exceeded");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
      rateLimitDelay: 100, // Short delay for test speed
      operationName: "getBlock",
    } as ExtendedRetryOptions);

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

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 100,
      rateLimitDelay: 1000,
    } as ExtendedRetryOptions);
    const duration = Date.now() - startTime;

    // Should take at least 2000ms (2 x 1000ms rate limit delays)
    expect(duration).toBeGreaterThanOrEqual(2000);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("defaults to 30 second rate limit delay when not specified", async () => {
    const http429Error = new Error("429");
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(http429Error)
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 100,
    } as ExtendedRetryOptions);
    const duration = Date.now() - startTime;

    // Should use default 30 second delay
    expect(duration).toBeGreaterThanOrEqual(30000);
  }, 35000); // 35 second timeout for this test
});
