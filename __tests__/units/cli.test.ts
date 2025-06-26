import * as fs from "fs";
import * as path from "path";

describe("CLI Entry Point", () => {
  const cliPath = path.join(__dirname, "../../src/cli.ts");

  describe("Source File", () => {
    it("should exist at src/cli.ts", () => {
      expect(fs.existsSync(cliPath)).toBe(true);
    });

    it("should have proper Node.js shebang", () => {
      const content = fs.readFileSync(cliPath, "utf-8");
      expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
    });
  });

  describe("Package Configuration", () => {
    const packageJsonPath = path.join(__dirname, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    it("should have bin field in package.json pointing to the CLI", () => {
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin.aep).toBe("dist/src/cli.js");
    });

    it("should have minimist in dependencies", () => {
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.minimist).toBeDefined();
      expect(typeof packageJson.dependencies.minimist).toBe("string");
    });

    it("should have postbuild script to make CLI executable", () => {
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.postbuild).toBe("chmod +x dist/src/cli.js");
    });

    it("should have @types/minimist in devDependencies", () => {
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies["@types/minimist"]).toBeDefined();
      expect(typeof packageJson.devDependencies["@types/minimist"]).toBe(
        "string",
      );
    });
  });
});
