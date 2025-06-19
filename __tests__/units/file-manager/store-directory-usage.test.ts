import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import { CHAIN_IDS } from "../../../src/types";

describe("FileManager - Store Directory Usage", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-manager-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir("/");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Store Directory Configuration", () => {
    it("should use the provided store directory for ensureStoreDirectory", () => {
      const customDir = "my-custom-store";
      const fileManager = new FileManager(customDir);

      fileManager.ensureStoreDirectory();

      // Should create the custom directory, not the hardcoded "store"
      expect(fs.existsSync(customDir)).toBe(true);
      expect(fs.existsSync("store")).toBe(false);
    });

    it("should use the provided store directory for block numbers file", () => {
      const customDir = "data-store";
      const fileManager = new FileManager(customDir);

      const blockData = {
        metadata: { chain_id: CHAIN_IDS.ARBITRUM_NOVA },
        blocks: { "2024-01-15": 12345 },
      };

      fileManager.writeBlockNumbers(blockData);

      // Should write to custom directory, not hardcoded "store"
      expect(fs.existsSync(path.join(customDir, "block_numbers.json"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join("store", "block_numbers.json"))).toBe(
        false,
      );
    });

    it("should use the provided store directory for distributor files", () => {
      const customDir = "distributor-data";
      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const fileManager = new FileManager(customDir);

      const balanceData = {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_NOVA,
          reward_distributor: address,
        },
        balances: {
          "2024-01-15": {
            block_number: 12345,
            balance_wei: "1000000000000000000",
          },
        },
      };

      fileManager.writeDistributorBalances(address, balanceData);

      // Should write to custom directory structure
      const expectedPath = path.join(
        customDir,
        "distributors",
        address,
        "balances.json",
      );
      expect(fs.existsSync(expectedPath)).toBe(true);

      // Should not create hardcoded "store" directory
      expect(fs.existsSync("store")).toBe(false);
    });

    it("should support different store directories for different instances", () => {
      const dir1 = "store1";
      const dir2 = "store2";

      const fileManager1 = new FileManager(dir1);
      const fileManager2 = new FileManager(dir2);

      fileManager1.ensureStoreDirectory();
      fileManager2.ensureStoreDirectory();

      expect(fs.existsSync(dir1)).toBe(true);
      expect(fs.existsSync(dir2)).toBe(true);
    });
  });
});
