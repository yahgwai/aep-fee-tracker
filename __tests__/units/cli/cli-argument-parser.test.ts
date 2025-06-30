import { parseArguments } from "../../../src/cli/parse-arguments";

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
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject invalid URL with wrong protocol", () => {
      const args = ["--rpc-url", "ftp://archive-node.com"];

      expect(() => parseArguments(args)).toThrow(
        "Invalid RPC URL: URL must start with http:// or https://",
      );
    });

    it("should reject malformed URL", () => {
      const args = ["--rpc-url", "https://[invalid"];

      expect(() => parseArguments(args)).toThrow(
        "Invalid RPC URL: Invalid URL",
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

  describe("Unknown Arguments Validation", () => {
    it("should reject single unknown argument", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--unknown",
        "value",
      ];

      expect(() => parseArguments(args)).toThrow("Unknown argument: --unknown");
    });

    it("should reject misspelled argument", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--stroe-dir",
        "/data/aep-fees",
      ];

      expect(() => parseArguments(args)).toThrow(
        "Unknown argument: --stroe-dir",
      );
    });

    it("should reject multiple unknown arguments", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--unknown1",
        "value1",
        "--unknown2",
        "value2",
      ];

      expect(() => parseArguments(args)).toThrow(
        /Unknown arguments: --unknown1, --unknown2/,
      );
    });

    it("should include valid arguments list in error message", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--unknown",
        "value",
      ];

      expect(() => parseArguments(args)).toThrow();

      try {
        parseArguments(args);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain("Valid arguments:");
        expect(message).toContain("--rpc-url");
        expect(message).toContain("--start-date");
        expect(message).toContain("--end-date");
        expect(message).toContain("--store-dir");
      }
    });

    it("should provide descriptions for valid arguments", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--unknown",
        "value",
      ];

      expect(() => parseArguments(args)).toThrow();

      try {
        parseArguments(args);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain(
          "--rpc-url <url>      RPC endpoint URL (required)",
        );
        expect(message).toContain(
          "--start-date <date>  Start date in YYYY-MM-DD format",
        );
        expect(message).toContain(
          "--end-date <date>    End date in YYYY-MM-DD format",
        );
        expect(message).toContain(
          "--store-dir <path>   Directory for storing data",
        );
      }
    });

    it("should accept all valid arguments without error", () => {
      const validCombinations = [
        ["--rpc-url", "https://archive-node.com/rpc"],
        [
          "--rpc-url",
          "https://archive-node.com/rpc",
          "--start-date",
          "2024-01-01",
        ],
        [
          "--rpc-url",
          "https://archive-node.com/rpc",
          "--end-date",
          "2024-01-31",
        ],
        ["--rpc-url", "https://archive-node.com/rpc", "--store-dir", "/data"],
        [
          "--rpc-url",
          "https://archive-node.com/rpc",
          "--start-date",
          "2024-01-01",
          "--end-date",
          "2024-01-31",
          "--store-dir",
          "/data",
        ],
      ];

      validCombinations.forEach((args) => {
        expect(() => parseArguments(args)).not.toThrow();
      });
    });

    it("should handle boolean flags as unknown arguments", () => {
      const args = ["--rpc-url", "https://archive-node.com/rpc", "--verbose"];

      expect(() => parseArguments(args)).toThrow("Unknown argument: --verbose");
    });

    it("should handle arguments with special characters", () => {
      const args = [
        "--rpc-url",
        "https://archive-node.com/rpc",
        "--special-chars!@#",
        "value",
      ];

      expect(() => parseArguments(args)).toThrow(
        "Unknown argument: --special-chars!@#",
      );
    });
  });
});
