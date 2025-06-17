import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { withRetry, RetryOptions } from "../../../src/utils/retry";

interface ExtendedRetryOptions extends RetryOptions {
  operationName?: string;
}

describe("Retry Logging", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs retry attempts with operation name", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({ number: 100 });

    await withRetry(mockCall, {
      maxRetries: 3,
      initialDelay: 10,
      operationName: "getBlock",
    } as ExtendedRetryOptions);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Retry attempt 1/3 for getBlock"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Retry attempt 2/3 for getBlock"),
    );
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("logs retry attempts without operation name", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ number: 100 });

    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 10,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Retry attempt 1/2"),
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it("does not log when operation succeeds on first attempt", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockResolvedValueOnce({ number: 100 });

    await withRetry(mockCall, {
      maxRetries: 3,
      operationName: "getBlock",
    } as ExtendedRetryOptions);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs error message with retry attempt", async () => {
    const errorMessage = "Connection timeout";
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce({ number: 100 });

    await withRetry(mockCall, {
      maxRetries: 2,
      initialDelay: 10,
      operationName: "fetchData",
    } as ExtendedRetryOptions);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Retry attempt 1/2 for fetchData after error: ${errorMessage}`,
      ),
    );
  });
});
