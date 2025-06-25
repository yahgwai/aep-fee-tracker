import { createConfiguration } from "../../src/configuration";
import { ParsedArguments } from "../../src/parse-arguments";

describe("Configuration Module", () => {
  describe("createConfiguration", () => {
    it("should create configuration from parsed arguments", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config).toBeDefined();
    });
  });
});
