import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

describe("test-utils environment configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear the module cache to ensure fresh imports
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe("ARBITRUM_NOVA_RPC_URL", () => {
    it("should use RPC URL from ARBITRUM_NOVA_RPC_URL environment variable", () => {
      const testRpcUrl = "https://test-rpc.example.com";
      process.env["ARBITRUM_NOVA_RPC_URL"] = testRpcUrl;

      // Re-import to get updated env value
      jest.isolateModules(() => {
        const testUtils = require("./test-utils");
        expect(testUtils.ARBITRUM_NOVA_RPC_URL).toBe(testRpcUrl);
      });
    });

    it("should be undefined when environment variable is not set", () => {
      delete process.env["ARBITRUM_NOVA_RPC_URL"];

      jest.isolateModules(() => {
        const testUtils = require("./test-utils");
        expect(testUtils.ARBITRUM_NOVA_RPC_URL).toBeUndefined();
      });
    });
  });

  describe("createProvider", () => {
    it("should use environment variable RPC URL by default", () => {
      const testRpcUrl = "https://env-test-rpc.example.com";
      process.env["ARBITRUM_NOVA_RPC_URL"] = testRpcUrl;

      jest.isolateModules(() => {
        const testUtils = require("./test-utils");
        const provider = testUtils.createProvider();

        // In ethers v6, check the _request property
        expect(provider._getConnection().url).toBe(testRpcUrl);
      });
    });

    it("should throw error when no RPC URL provided and env var not set", () => {
      delete process.env["ARBITRUM_NOVA_RPC_URL"];

      jest.isolateModules(() => {
        const testUtils = require("./test-utils");
        expect(() => testUtils.createProvider()).toThrow();
      });
    });

    it("should allow overriding with explicit RPC URL parameter", () => {
      const overrideUrl = "https://override-rpc.example.com";
      process.env["ARBITRUM_NOVA_RPC_URL"] = "https://env-rpc.example.com";

      jest.isolateModules(() => {
        const testUtils = require("./test-utils");
        const provider = testUtils.createProvider(overrideUrl);
        expect(provider._getConnection().url).toBe(overrideUrl);
      });
    });
  });
});
