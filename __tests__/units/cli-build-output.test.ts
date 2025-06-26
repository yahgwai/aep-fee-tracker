import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

describe("CLI Build Output", () => {
  const distCliPath = path.join(__dirname, "../../dist/src/cli.js");

  beforeAll(() => {
    // Ensure a fresh build before running tests
    execSync("npm run build", {
      cwd: path.join(__dirname, "../.."),
      stdio: "pipe",
    });
  });

  describe("Shebang Preservation", () => {
    it("should preserve the shebang line in compiled output", () => {
      const compiledContent = fs.readFileSync(distCliPath, "utf-8");
      expect(compiledContent.startsWith("#!/usr/bin/env node")).toBe(true);
    });

    it("should have shebang as the very first line", () => {
      const compiledContent = fs.readFileSync(distCliPath, "utf-8");
      const firstLine = compiledContent.split("\n")[0];
      expect(firstLine).toBe("#!/usr/bin/env node");
    });
  });

  describe("CLI Files Compilation", () => {
    const expectedCliFiles = [
      "dist/src/cli.js",
      "dist/src/cli.d.ts",
      "dist/src/cli.js.map",
      "dist/src/orchestrator.js",
      "dist/src/orchestrator.d.ts",
      "dist/src/parse-arguments.js",
      "dist/src/parse-arguments.d.ts",
      "dist/src/configuration.js",
      "dist/src/configuration.d.ts",
    ];

    it("should compile all CLI-related files to dist", () => {
      const projectRoot = path.join(__dirname, "../..");

      for (const file of expectedCliFiles) {
        const filePath = path.join(projectRoot, file);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it("should generate source maps for debugging", () => {
      const projectRoot = path.join(__dirname, "../..");
      const sourceMaps = [
        "dist/src/cli.js.map",
        "dist/src/orchestrator.js.map",
        "dist/src/parse-arguments.js.map",
        "dist/src/configuration.js.map",
      ];

      for (const map of sourceMaps) {
        const mapPath = path.join(projectRoot, map);
        expect(fs.existsSync(mapPath)).toBe(true);
      }
    });

    it("should generate TypeScript declaration files", () => {
      const projectRoot = path.join(__dirname, "../..");
      const declarations = [
        "dist/src/cli.d.ts",
        "dist/src/orchestrator.d.ts",
        "dist/src/parse-arguments.d.ts",
        "dist/src/configuration.d.ts",
      ];

      for (const declaration of declarations) {
        const declPath = path.join(projectRoot, declaration);
        expect(fs.existsSync(declPath)).toBe(true);

        // Verify it's a valid declaration file
        const content = fs.readFileSync(declPath, "utf-8");
        expect(content).toContain("export");
      }
    });
  });

  describe("Executable Structure", () => {
    it("should have executable permissions on CLI file", () => {
      const stats = fs.statSync(distCliPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    it("should be a valid Node.js executable", () => {
      // Test that the CLI can be executed
      const result = execSync(
        `node "${distCliPath}" --help 2>&1 || echo "Exit code: $?"`,
        {
          encoding: "utf-8",
        },
      );

      // Should show usage information
      expect(result).toContain("Usage: aep");
      expect(result).toContain("--rpc-url");
    });

    it("should maintain correct module imports after compilation", () => {
      const compiledContent = fs.readFileSync(distCliPath, "utf-8");

      // Check that imports are correctly transformed
      expect(compiledContent).toContain('require("./parse-arguments")');
      expect(compiledContent).toContain('require("./configuration")');
      expect(compiledContent).toContain('require("./orchestrator")');
    });
  });

  describe("TypeScript Configuration Coverage", () => {
    const tsConfigPath = path.join(__dirname, "../../tsconfig.json");
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf-8"));

    it("should include src directory in compilation", () => {
      expect(tsConfig.include).toContain("src/**/*");
    });

    it("should output to dist directory", () => {
      expect(tsConfig.compilerOptions.outDir).toBe("./dist");
    });

    it("should have rootDir set to project root", () => {
      expect(tsConfig.compilerOptions.rootDir).toBe("./");
    });

    it("should generate declaration files", () => {
      expect(tsConfig.compilerOptions.declaration).toBe(true);
    });

    it("should generate source maps", () => {
      expect(tsConfig.compilerOptions.sourceMap).toBe(true);
    });

    it("should compile all required CLI dependencies", () => {
      const projectRoot = path.join(__dirname, "../..");

      // Check that all files imported by CLI are also compiled
      const cliDependencies = [
        "dist/src/date-validation.js",
        "dist/src/url-validation.js",
        "dist/src/types/index.js",
        "dist/src/block-finder.js",
        "dist/src/distributor-detector.js",
        "dist/src/balance-fetcher.js",
        "dist/src/recipient-recieved-scanner.js",
        "dist/src/fee-calculator.js",
      ];

      for (const dep of cliDependencies) {
        const depPath = path.join(projectRoot, dep);
        expect(fs.existsSync(depPath)).toBe(true);
      }
    });
  });
});
