import { describe, it, expect, jest } from "@jest/globals";
import { retryRPCCall } from "../../../src/block-finder";
import { RPCError } from "../../../src/types";

describe("RPC Retry Logic", () => {
  it("returns result on first successful call", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockResolvedValue({ number: 100 });

    const result = await retryRPCCall(mockCall, "getBlock");

    expect(result).toEqual({ number: 100 });
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("retries up to 3 times on failure", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({ number: 100 });

    const result = await retryRPCCall(mockCall, "getBlock");

    expect(result).toEqual({ number: 100 });
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("throws RPCError after 3 failed retries", async () => {
    const mockCall = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Connection refused"));

    await expect(retryRPCCall(mockCall, "getBlock")).rejects.toThrow(RPCError);

    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("includes all context in error after retries exhausted", async () => {
    const originalError = new Error("Connection timeout");
    const mockCall = jest
      .fn<() => Promise<never>>()
      .mockRejectedValue(originalError);

    try {
      await retryRPCCall(mockCall, "getBlock");
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RPCError);
      const rpcError = error as RPCError;
      expect(rpcError.message).toContain("Failed to getBlock after 3 retries");
      expect(rpcError.operation).toBe("getBlock");
      expect(rpcError.retryCount).toBe(3);
      expect(rpcError.cause).toBe(originalError);
    }
  });

  it("uses exponential backoff between retries", async () => {
    const mockCall = jest
      .fn<() => Promise<{ number: number }>>()
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"))
      .mockResolvedValueOnce({ number: 100 });

    const startTime = Date.now();
    await retryRPCCall(mockCall, "getBlock");
    const duration = Date.now() - startTime;

    // Should take at least 3 seconds (1s + 2s delays)
    expect(duration).toBeGreaterThanOrEqual(3000);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });
});
