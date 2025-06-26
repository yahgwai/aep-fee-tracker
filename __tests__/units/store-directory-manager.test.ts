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
});
