import { validateAndCreateStoreDirectory } from "../../src/store-directory-manager";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Store Directory Manager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-dir-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir("/");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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
      fs.mkdirSync("data");
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

  describe("Parent Directory Validation", () => {
    it("throws error when parent directory does not exist", () => {
      expect(() =>
        validateAndCreateStoreDirectory("./nonexistent/store"),
      ).toThrow("Parent directory './nonexistent' does not exist");
    });

    it("succeeds when parent directory exists", () => {
      fs.mkdirSync("existing");
      const result = validateAndCreateStoreDirectory("./existing/store");
      expect(result).toBe("./existing/store");
    });
  });

  describe("Directory Creation", () => {
    it("creates directory when it does not exist", () => {
      const storePath = "./newstore";
      expect(fs.existsSync(storePath)).toBe(false);

      validateAndCreateStoreDirectory(storePath);

      expect(fs.existsSync(storePath)).toBe(true);
    });

    it("does not throw when directory already exists", () => {
      const storePath = "./existingstore";
      fs.mkdirSync(storePath);

      expect(() => validateAndCreateStoreDirectory(storePath)).not.toThrow();
      expect(fs.existsSync(storePath)).toBe(true);
    });

    it("creates nested directory when parent exists", () => {
      const parentPath = "./parent";
      const storePath = "./parent/store";
      fs.mkdirSync(parentPath);

      expect(fs.existsSync(storePath)).toBe(false);

      validateAndCreateStoreDirectory(storePath);

      expect(fs.existsSync(storePath)).toBe(true);
    });

    it("returns path when file already exists with same name", () => {
      // If a file exists at the path, we don't try to create a directory
      const storePath = "./fileasdir";
      fs.writeFileSync(storePath, "test");

      const result = validateAndCreateStoreDirectory(storePath);
      expect(result).toBe(storePath);
    });
  });
});
