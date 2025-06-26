import { parseArguments } from "../../src/parse-arguments";

describe("CLI Argument Parser", () => {
  describe("Required Arguments", () => {
    it("should parse --rpc-url argument", () => {
      const args = ["--rpc-url", "https://archive-node.com/rpc"];
      const result = parseArguments(args);

      expect(result["rpc-url"]).toBe("https://archive-node.com/rpc");
    });

    it("should throw error when --rpc-url is missing", () => {
      const args: string[] = [];

      expect(() => parseArguments(args)).toThrow("--rpc-url is required");
    });

    it("should include usage help in error when --rpc-url is missing", () => {
      const args: string[] = [];

      expect(() => parseArguments(args)).toThrow(/Usage: aep --rpc-url <url>/);
    });
  });

  describe("URL Validation", () => {
    it("should reject invalid URL without protocol", () => {
      const args = ["--rpc-url", "archive-node.com/rpc"];

      expect(() => parseArguments(args)).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://"
      );
    });

    it("should reject invalid URL with wrong protocol", () => {
      const args = ["--rpc-url", "ftp://archive-node.com"];

      expect(() => parseArguments(args)).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://"
      );
    });

    it("should reject malformed URL", () => {
      const args = ["--rpc-url", "https://[invalid"];

      expect(() => parseArguments(args)).toThrow(
        "Invalid RPC URL: Invalid URL"
      );
    });

    it("should accept valid HTTP URL", () => {
      const args = ["--rpc-url", "http://localhost:8545"];
      const result = parseArguments(args);

      expect(result["rpc-url"]).toBe("http://localhost:8545");
    });

    it("should accept valid HTTPS URL", () => {
      const args = ["--rpc-url", "https://archive-node.com/rpc"];
      const result = parseArguments(args);

      expect(result["rpc-url"]).toBe("https://archive-node.com/rpc");
    });
  });

  describe("Optional Arguments", () => {
    it("should parse --start-date argument", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--start-date",
        "2024-01-01",
      ];
      const result = parseArguments(args);

      expect(result["start-date"]).toBe("2024-01-01");
    });

    it("should parse --end-date argument", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--end-date",
        "2024-01-31",
      ];
      const result = parseArguments(args);

      expect(result["end-date"]).toBe("2024-01-31");
    });

    it("should parse --store-dir argument", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--store-dir",
        "/data/aep-fees",
      ];
      const result = parseArguments(args);

      expect(result["store-dir"]).toBe("/data/aep-fees");
    });

    it("should parse all optional arguments together", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--start-date",
        "2024-01-01",
        "--end-date",
        "2024-01-31",
        "--store-dir",
        "/data/aep-fees",
      ];
      const result = parseArguments(args);

      expect(result["rpc-url"]).toBe("https://archive-node.com/rpc");
      expect(result["start-date"]).toBe("2024-01-01");
      expect(result["end-date"]).toBe("2024-01-31");
      expect(result["store-dir"]).toBe("/data/aep-fees");
    });
  });
});
