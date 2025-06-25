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

    it("should apply default store directory when not provided", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.storeDirectory).toBe("./store");
    });

    it("should use provided store directory", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        "store-dir": "/data/aep-fees",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.storeDirectory).toBe("/data/aep-fees");
    });

    it("should include RPC URL in configuration", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.rpcUrl).toBe("https://archive-node.com/rpc");
    });

    it("should include start date when provided", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        "start-date": "2024-01-01",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.startDate).toBe("2024-01-01");
    });

    it("should include end date when provided", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        "end-date": "2024-01-31",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.endDate).toBe("2024-01-31");
    });

    it("should not include dates when not provided", () => {
      const parsedArgs: ParsedArguments = {
        "rpc-url": "https://archive-node.com/rpc",
        _: [],
      };

      const config = createConfiguration(parsedArgs);

      expect(config.startDate).toBeUndefined();
      expect(config.endDate).toBeUndefined();
    });
  });
});
