import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("CLI Integration", () => {
  const cliPath = path.join(__dirname, "../../src/cli.ts");
  let testStoreDir: string;

  beforeEach(() => {
    // Create a temporary directory for test store
    testStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "aep-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(testStoreDir)) {
      fs.rmSync(testStoreDir, { recursive: true, force: true });
    }
  });

  function runCLI(args: string[]): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn("npx", ["ts-node", cliPath, ...args], {
        env: { ...process.env, NODE_ENV: "test" },
        timeout: 30000, // 30 second timeout
      });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
    });
  }

  describe("Successful Execution", () => {
    it("should exit with code 0 when given valid RPC URL and all components succeed", async () => {
      const { code, stderr } = await runCLI([
        "--rpc-url",
        "https://valid-archive-node.com/rpc",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(0);
      // Success should not output errors to stderr (excluding third-party warnings)
      expect(stderr).not.toContain("Error:");
    }, 35000);

    it("should accept all optional arguments and execute successfully", async () => {
      const { code } = await runCLI([
        "--rpc-url",
        "https://valid-archive-node.com/rpc",
        "--start-date",
        "2024-01-01",
        "--end-date",
        "2024-01-31",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(0);
    }, 35000);
  });

  describe("Missing Required Arguments", () => {
    it("should exit with code 1 when --rpc-url is missing", async () => {
      const { code, stderr } = await runCLI([]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
      expect(stderr).toContain("--rpc-url is required");
    });

    it("should output usage message to stderr when --rpc-url is missing", async () => {
      const { stderr, stdout } = await runCLI([]);

      expect(stderr).toContain("Usage: aep --rpc-url");
      // Error messages should not go to stdout
      expect(stdout).not.toContain("--rpc-url is required");
      expect(stdout).not.toContain("Usage:");
    });

    it("should exit with code 1 even when optional arguments are provided without --rpc-url", async () => {
      const { code, stderr } = await runCLI([
        "--start-date",
        "2024-01-01",
        "--end-date",
        "2024-01-31",
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("--rpc-url is required");
    });
  });

  describe("Component Error Propagation", () => {
    it("should output orchestrator errors to stderr and exit with code 1", async () => {
      // Use an invalid URL that will cause orchestrator to fail
      const { code, stderr, stdout } = await runCLI([
        "--rpc-url",
        "invalid-url",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
      // Component errors should not go to stdout
      expect(stdout).not.toContain("Error:");
    });

    it("should propagate RPC connection errors to stderr", async () => {
      // Use a URL that will fail to connect
      const { code, stderr } = await runCLI([
        "--rpc-url",
        "https://definitely-not-a-real-rpc-endpoint.invalid",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
    }, 35000);

    it("should handle file system errors gracefully", async () => {
      // Use a store directory that cannot be created
      const invalidStoreDir = "/root/cannot-create-this/store";
      const { code, stderr } = await runCLI([
        "--rpc-url",
        "https://valid-archive-node.com/rpc",
        "--store-dir",
        invalidStoreDir,
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
    });
  });

  describe("Invalid Arguments", () => {
    it("should exit with code 1 for malformed date arguments", async () => {
      const { code, stderr } = await runCLI([
        "--rpc-url",
        "https://valid-archive-node.com/rpc",
        "--start-date",
        "not-a-date",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
    });

    it("should exit with code 1 when start-date is after end-date", async () => {
      const { code, stderr } = await runCLI([
        "--rpc-url",
        "https://valid-archive-node.com/rpc",
        "--start-date",
        "2024-01-31",
        "--end-date",
        "2024-01-01",
        "--store-dir",
        testStoreDir,
      ]);

      expect(code).toBe(1);
      expect(stderr).toContain("Error:");
    });
  });

  describe("Error Output Format", () => {
    it("should format error messages clearly on stderr", async () => {
      const { stderr } = await runCLI([]);

      // Should have "Error:" prefix
      expect(stderr).toMatch(/Error:/);
      // Should not have stack traces in production mode
      expect(stderr).not.toContain("at Object.");
      expect(stderr).not.toContain("at Module.");
    });

    it("should output clean error messages without internal details", async () => {
      const { stderr } = await runCLI([
        "--rpc-url",
        "invalid-url",
        "--store-dir",
        testStoreDir,
      ]);

      // Should contain user-friendly error message
      expect(stderr).toContain("Error:");
      // Should not expose internal module names or paths
      expect(stderr).not.toMatch(/\/src\//);
      expect(stderr).not.toMatch(/node_modules/);
    });
  });
});
