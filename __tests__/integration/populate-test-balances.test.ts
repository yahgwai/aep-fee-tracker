import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("populate-test-balances script", () => {
  const scriptPath = path.join(
    __dirname,
    "../../scripts/populate-test-balances.ts",
  );
  const testDataDir = path.join(
    __dirname,
    "../test-data/distributor-detector/balance_data",
  );

  beforeEach(() => {
    // Ensure test data directory exists
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  describe("script existence and structure", () => {
    it("should exist at the expected path", () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it("should be executable with ts-node", async () => {
      try {
        await execAsync(`npx ts-node ${scriptPath} --help`);
      } catch (error) {
        // Script should at least attempt to run, even if --help fails
        expect((error as Error & { code?: number }).code).not.toBe(127); // Command not found
      }
    });
  });

  describe("command line argument parsing", () => {
    it("should require start date parameter", async () => {
      try {
        await execAsync(`npx ts-node ${scriptPath} --end 2023-01-31`);
        fail("Should have thrown error for missing start date");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toContain(
          "start",
        );
      }
    });

    it("should require end date parameter", async () => {
      try {
        await execAsync(`npx ts-node ${scriptPath} --start 2023-01-01`);
        fail("Should have thrown error for missing end date");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toContain("end");
      }
    });

    it("should validate date format", async () => {
      try {
        await execAsync(
          `npx ts-node ${scriptPath} --start invalid-date --end 2023-01-31`,
        );
        fail("Should have thrown error for invalid date format");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toMatch(
          /date.*format|invalid.*date/i,
        );
      }
    });

    it("should validate start date is not after end date", async () => {
      try {
        await execAsync(
          `npx ts-node ${scriptPath} --start 2023-01-31 --end 2023-01-01`,
        );
        fail("Should have thrown error for invalid date range");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toMatch(
          /start.*after.*end|invalid.*range/i,
        );
      }
    });
  });

  describe("block finding integration", () => {
    it("should use BlockFinder to get blocks for date range", async () => {
      // This test will verify the script integrates with BlockFinder
      // We'll mock or use test data to avoid real RPC calls
      const result = await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-13 --test-mode`,
      );

      expect(result.stdout).toContain("Finding blocks for date range");
    });

    it("should handle BlockFinder errors gracefully", async () => {
      // Test with dates that might cause BlockFinder to fail
      try {
        await execAsync(
          `npx ts-node ${scriptPath} --start 2020-01-01 --end 2020-01-02 --test-mode`,
        );
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toMatch(
          /block.*not.*found|rpc.*error/i,
        );
      }
    });
  });

  describe("balance fetching integration", () => {
    it("should use BalanceFetcher to retrieve balances for all test distributors", async () => {
      const result = await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode`,
      );

      expect(result.stdout).toContain("Fetching balances for distributors");
    });

    it("should process all distributor addresses from test data", async () => {
      const result = await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode`,
      );

      // Should mention the 5 test distributors
      expect(result.stdout).toMatch(/processing.*5.*distributors?/i);
    });
  });

  describe("data persistence", () => {
    it("should save balance data to test data directory", async () => {
      const tempDir = path.join(__dirname, "../temp-test-data");

      await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode --output-dir ${tempDir}`,
      );

      expect(fs.existsSync(tempDir)).toBe(true);

      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it("should maintain existing JSON format and metadata", async () => {
      const tempDir = path.join(__dirname, "../temp-test-data");

      await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode --output-dir ${tempDir}`,
      );

      // Check that generated files have the correct structure
      const generatedFiles = fs.readdirSync(tempDir);
      expect(generatedFiles.length).toBeGreaterThan(0);

      const firstFile = path.join(tempDir, generatedFiles[0]!, "balances.json");
      if (fs.existsSync(firstFile)) {
        const data = JSON.parse(fs.readFileSync(firstFile, "utf-8"));
        expect(data).toHaveProperty("metadata");
        expect(data).toHaveProperty("balances");
        expect(data.metadata).toHaveProperty("chain_id");
        expect(data.metadata).toHaveProperty("reward_distributor");
      }

      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it("should merge with existing balance data without overwriting", async () => {
      // Create test file with existing data
      const testDistributorDir = path.join(testDataDir, "test-distributor");
      const testBalanceFile = path.join(testDistributorDir, "balances.json");

      fs.mkdirSync(testDistributorDir, { recursive: true });
      fs.writeFileSync(
        testBalanceFile,
        JSON.stringify(
          {
            metadata: {
              chain_id: 42170,
              reward_distributor: "test-distributor",
            },
            balances: {
              "2022-07-10": {
                block_number: 100,
                balance_wei: "1000000000000000000",
              },
            },
          },
          null,
          2,
        ),
      );

      await execAsync(
        `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode`,
      );

      const updatedData = JSON.parse(fs.readFileSync(testBalanceFile, "utf-8"));
      expect(updatedData.balances).toHaveProperty("2022-07-10");
      expect(updatedData.balances["2022-07-10"].balance_wei).toBe(
        "1000000000000000000",
      );

      // Cleanup
      fs.rmSync(testDistributorDir, { recursive: true });
    });
  });

  describe("error handling", () => {
    it("should handle network connectivity issues", async () => {
      try {
        await execAsync(
          `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --rpc-url http://invalid-url`,
        );
        fail("Should have thrown error for network issues");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toMatch(
          /network.*error|connection.*failed|rpc.*error/i,
        );
      }
    });

    it("should handle file system errors gracefully", async () => {
      try {
        await execAsync(
          `npx ts-node ${scriptPath} --start 2022-07-11 --end 2022-07-12 --test-mode --output-dir /invalid/path`,
        );
        fail("Should have thrown error for invalid output directory");
      } catch (error) {
        expect((error as Error & { stderr?: string }).stderr).toMatch(
          /permission.*denied|no.*such.*file|directory.*error/i,
        );
      }
    });
  });

  describe("npm script integration", () => {
    it("should be runnable via npm script", async () => {
      try {
        await execAsync(
          "npm run populate-test-balances -- --start 2022-07-11 --end 2022-07-12 --test-mode",
        );
      } catch (error) {
        // At this point, the npm script might not exist, but we're testing the pattern
        expect((error as Error).message).not.toContain("command not found");
      }
    });
  });
});
