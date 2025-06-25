import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

describe("CLI Entry Point", () => {
  const cliPath = path.join(__dirname, "../../src/cli.ts");
  const compiledCliPath = path.join(__dirname, "../../dist/src/cli.js");

  describe("Source File", () => {
    it("should exist at src/cli.ts", () => {
      expect(fs.existsSync(cliPath)).toBe(true);
    });

    it("should have proper Node.js shebang", () => {
      const content = fs.readFileSync(cliPath, "utf-8");
      expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
    });
  });

  describe("Compiled File", () => {
    it("should exist at dist/src/cli.js after build", () => {
      expect(fs.existsSync(compiledCliPath)).toBe(true);
    });

    it("should have executable permissions", () => {
      const stats = fs.statSync(compiledCliPath);
      const isExecutable = (stats.mode & parseInt("111", 8)) !== 0;
      expect(isExecutable).toBe(true);
    });
  });

  describe("Package Configuration", () => {
    it("should have bin field in package.json pointing to the CLI", () => {
      const packageJsonPath = path.join(__dirname, "../../package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin.aep).toBe("dist/src/cli.js");
    });
  });

  describe("Basic Execution", () => {
    it("should execute without errors when no arguments provided", () => {
      const cliCommand = path.join(__dirname, "../../dist/src/cli.js");

      expect(() => {
        execSync(cliCommand, { stdio: "pipe" });
      }).not.toThrow();
    });
  });
});
