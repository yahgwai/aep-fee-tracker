import { validateRpcUrl } from "../../../../src/utils/validation/url-validation";

describe("URL Validation", () => {
  describe("Valid URLs", () => {
    it("should accept HTTPS URL", () => {
      expect(() =>
        validateRpcUrl("https://archive-node.com/rpc"),
      ).not.toThrow();
    });

    it("should accept HTTP URL", () => {
      expect(() => validateRpcUrl("http://localhost:8545")).not.toThrow();
    });

    it("should accept URL with port", () => {
      expect(() =>
        validateRpcUrl("https://node.example.com:8545"),
      ).not.toThrow();
    });

    it("should accept URL with path", () => {
      expect(() =>
        validateRpcUrl("https://node.example.com/v1/mainnet"),
      ).not.toThrow();
    });

    it("should accept URL with port and path", () => {
      expect(() =>
        validateRpcUrl("https://node.example.com:8545/v1/mainnet"),
      ).not.toThrow();
    });

    it("should accept URL with query parameters", () => {
      expect(() =>
        validateRpcUrl("https://node.example.com/rpc?apikey=123"),
      ).not.toThrow();
    });

    it("should accept localhost URLs", () => {
      expect(() => validateRpcUrl("http://localhost:8545")).not.toThrow();
      expect(() => validateRpcUrl("http://127.0.0.1:8545")).not.toThrow();
    });
  });

  describe("Invalid URLs", () => {
    it("should reject URL without protocol", () => {
      expect(() => validateRpcUrl("archive-node.com/rpc")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject URL with invalid protocol", () => {
      expect(() => validateRpcUrl("ftp://archive-node.com")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject URL with ws protocol", () => {
      expect(() => validateRpcUrl("ws://archive-node.com")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject URL with wss protocol", () => {
      expect(() => validateRpcUrl("wss://archive-node.com")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject URL without host", () => {
      expect(() => validateRpcUrl("https://")).toThrow(
        "Invalid RPC URL: Invalid URL",
      );
    });

    it("should reject completely invalid URL", () => {
      expect(() => validateRpcUrl("not-a-url")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject empty string", () => {
      expect(() => validateRpcUrl("")).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject URL with spaces", () => {
      expect(() => validateRpcUrl("https://example .com")).toThrow(
        "Invalid RPC URL: Invalid URL",
      );
    });

    it("should reject malformed URLs", () => {
      expect(() => validateRpcUrl("https://[invalid")).toThrow(
        "Invalid RPC URL: Invalid URL",
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined", () => {
      expect(() => validateRpcUrl(undefined as unknown as string)).toThrow(
        "Invalid RPC URL: URL is required",
      );
    });

    it("should handle null", () => {
      expect(() => validateRpcUrl(null as unknown as string)).toThrow(
        "Invalid RPC URL: URL is required",
      );
    });

    it("should handle non-string values", () => {
      expect(() => validateRpcUrl(123 as unknown as string)).toThrow(
        "Invalid RPC URL: URL must be a string",
      );
    });
  });
});
