import { validateAndCreateStoreDirectory } from "../../src/store-directory-manager";

describe("Store Directory Manager", () => {
  describe("Default Value Handling", () => {
    it("returns './store' when no directory is provided", () => {
      const result = validateAndCreateStoreDirectory();
      expect(result).toBe("./store");
    });

    it("returns './store' when undefined is provided", () => {
      const result = validateAndCreateStoreDirectory(undefined);
      expect(result).toBe("./store");
    });
  });

  describe("Valid Path Formats", () => {
    it("returns the provided absolute path", () => {
      const result = validateAndCreateStoreDirectory("/tmp/store");
      expect(result).toBe("/tmp/store");
    });

    it("returns the provided relative path", () => {
      const result = validateAndCreateStoreDirectory("./mystore");
      expect(result).toBe("./mystore");
    });

    it("returns the provided nested relative path", () => {
      const result = validateAndCreateStoreDirectory("./data/store");
      expect(result).toBe("./data/store");
    });
  });

  describe("Invalid Path Formats", () => {
    it("throws error for empty string", () => {
      expect(() => validateAndCreateStoreDirectory("")).toThrow(
        "Store directory path cannot be empty",
      );
    });

    it("throws error for null path", () => {
      expect(() =>
        validateAndCreateStoreDirectory(null as unknown as string),
      ).toThrow("Store directory path must be a string");
    });

    it("throws error for path with invalid characters", () => {
      expect(() => validateAndCreateStoreDirectory("store\0dir")).toThrow(
        "Store directory path contains invalid characters",
      );
    });
  });
});
