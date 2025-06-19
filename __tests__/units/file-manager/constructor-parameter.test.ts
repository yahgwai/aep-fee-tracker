import { describe, it, expect } from "@jest/globals";
import { FileManager } from "../../../src/file-manager";

describe("FileManager - Constructor Parameter", () => {
  describe("Constructor", () => {
    it("should accept storeDirectory as constructor parameter", () => {
      const storeDir = "custom-store";
      const fileManager = new FileManager(storeDir);
      expect(fileManager).toBeDefined();
    });

    it("should throw error when storeDirectory is undefined", () => {
      // This test verifies constructor validates the parameter
      expect(() => new FileManager(undefined as unknown as string)).toThrow(
        "storeDirectory parameter is required",
      );
    });

    it("should throw error when storeDirectory is null", () => {
      // This test verifies constructor validates against null
      expect(() => new FileManager(null as unknown as string)).toThrow(
        "storeDirectory parameter is required",
      );
    });

    it("should throw error when storeDirectory is empty string", () => {
      // This test verifies constructor validates against empty string
      expect(() => new FileManager("")).toThrow(
        "storeDirectory cannot be empty",
      );
    });
  });
});
