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
});
