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

    describe("date validation", () => {
      it("should throw error for invalid start date format", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "start-date": "2024-1-1",
          _: [],
        };

        expect(() => createConfiguration(parsedArgs)).toThrow(
          "Invalid start date format: 2024-1-1. Expected YYYY-MM-DD",
        );
      });

      it("should throw error for invalid end date format", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "end-date": "2024/01/31",
          _: [],
        };

        expect(() => createConfiguration(parsedArgs)).toThrow(
          "Invalid end date format: 2024/01/31. Expected YYYY-MM-DD",
        );
      });

      it("should throw error for invalid start calendar date", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "start-date": "2024-02-30",
          _: [],
        };

        expect(() => createConfiguration(parsedArgs)).toThrow(
          "Invalid start calendar date: 2024-02-30",
        );
      });

      it("should throw error for invalid end calendar date", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "end-date": "2023-02-29",
          _: [],
        };

        expect(() => createConfiguration(parsedArgs)).toThrow(
          "Invalid end calendar date: 2023-02-29",
        );
      });

      it("should throw error when start date is after end date", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "start-date": "2024-02-01",
          "end-date": "2024-01-31",
          _: [],
        };

        expect(() => createConfiguration(parsedArgs)).toThrow(
          "Start date (2024-02-01) must be before or equal to end date (2024-01-31)",
        );
      });

      it("should accept valid date range", () => {
        const parsedArgs: ParsedArguments = {
          "rpc-url": "https://archive-node.com/rpc",
          "start-date": "2024-01-01",
          "end-date": "2024-01-31",
          _: [],
        };

        const config = createConfiguration(parsedArgs);

        expect(config.startDate).toBe("2024-01-01");
        expect(config.endDate).toBe("2024-01-31");
      });
    });
  });
});
