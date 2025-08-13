import { logger } from "../../../src/utils/logger";

describe("Logger", () => {
  describe("Test Environment Detection", () => {
    it("should detect test environment", () => {
      // NODE_ENV should be 'test' when running tests
      expect(process.env["NODE_ENV"]).toBe("test");
    });

    it("should not output logs in test environment", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      logger.log("This should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should not output warnings in test environment", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      logger.warn("This warning should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should still output errors in test environment", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      logger.error("This error should appear");

      expect(consoleSpy).toHaveBeenCalledWith("This error should appear");

      consoleSpy.mockRestore();
    });
  });
});
