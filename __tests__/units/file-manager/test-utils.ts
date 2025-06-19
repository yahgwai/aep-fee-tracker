import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileManager } from "../../../src/file-manager";
import {
  FileManager as FileManagerInterface,
  STORE_DIR,
} from "../../../src/types";

// Common test constants
export const VALID_ADDRESS = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
export const VALID_ADDRESS_LOWERCASE =
  "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";
export const VALID_ADDRESS_2 = "0x88fBd15B9B0126f2C6A0A2A35B88C6Df2c8CB72E";
export const VALID_ADDRESS_2_LOWERCASE =
  "0x88fbd15b9b0126f2c6a0a2a35b88c6df2c8cb72e";
export const INVALID_ADDRESS = "0x1234567890123456789012345678901234567890";
export const VALID_TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
export const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// Test setup helpers
export function setupFileManager(): FileManagerInterface {
  return new FileManager(STORE_DIR);
}

export interface TestContext {
  tempDir: string;
  fileManager: FileManagerInterface;
}

export function setupTestEnvironment(): TestContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-manager-test-"));
  process.chdir(tempDir);
  const fileManager = setupFileManager();
  return { tempDir, fileManager };
}

export function cleanupTestEnvironment(tempDir: string): void {
  process.chdir("/");
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Common test data factories
export function createTestDate(offsetDays: number = 0): string {
  const date = new Date("2024-01-15T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const isoString = date.toISOString();
  const datePart = isoString.split("T")[0];
  if (!datePart) {
    throw new Error("Invalid date format");
  }
  return datePart;
}

// Validation test helpers
export function expectValidationError(
  fn: () => void,
  expectedMessage: string | RegExp,
): void {
  expect(fn).toThrow(expectedMessage);
}
