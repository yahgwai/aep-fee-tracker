import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { ValidationError, DistributorType } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Validation Tests', () => {
  let tempDir: string;
  let fileManager: FileManager;

  beforeEach(() => {
    tempDir = path.join(__dirname, `../tmp-${randomBytes(8).toString('hex')}`);
    fs.mkdirSync(tempDir, { recursive: true });
    process.chdir(tempDir);
    fileManager = new FileManager();
  });

  afterEach(() => {
    process.chdir(__dirname);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Address Validation', () => {
    it('should checksum lowercase addresses before storing', async () => {
      const lowercaseAddress = "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9";
      const checksummedAddress = fileManager.validateAddress(lowercaseAddress);
      
      expect(checksummedAddress).toBe("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
    });

    it('should accept already checksummed addresses', async () => {
      const checksummedAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const result = fileManager.validateAddress(checksummedAddress);
      
      expect(result).toBe(checksummedAddress);
    });

    it('should reject addresses shorter than 42 characters', async () => {
      const shortAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d";
      
      expect(() => fileManager.validateAddress(shortAddress)).toThrow(ValidationError);
      expect(() => fileManager.validateAddress(shortAddress)).toThrow(/Address must be 42 characters/);
    });

    it('should reject addresses longer than 42 characters', async () => {
      const longAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d99";
      
      expect(() => fileManager.validateAddress(longAddress)).toThrow(ValidationError);
      expect(() => fileManager.validateAddress(longAddress)).toThrow(/Address must be 42 characters/);
    });

    it('should reject addresses with invalid characters', async () => {
      const invalidAddress = "0xGGGG4CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      
      expect(() => fileManager.validateAddress(invalidAddress)).toThrow(ValidationError);
      expect(() => fileManager.validateAddress(invalidAddress)).toThrow(/Invalid address format/);
    });

    it('should reject addresses that don\'t start with 0x', async () => {
      const invalidAddress = "1234567890123456789012345678901234567890AB";
      
      expect(() => fileManager.validateAddress(invalidAddress)).toThrow(ValidationError);
      expect(() => fileManager.validateAddress(invalidAddress)).toThrow(/Address must start with 0x/);
    });

    it('should provide specific error for invalid checksum', async () => {
      const invalidChecksumAddress = "0x67a24CE4321AB3AF51c2D0a4801c3E111D88C9d9";
      
      expect(() => fileManager.validateAddress(invalidChecksumAddress)).toThrow(ValidationError);
      expect(() => fileManager.validateAddress(invalidChecksumAddress)).toThrow(/Invalid address checksum/);
    });
  });

  describe('Date Validation', () => {
    it('should accept valid YYYY-MM-DD format dates', async () => {
      expect(fileManager.isValidDateString("2024-01-15")).toBe(true);
      expect(fileManager.isValidDateString("2023-12-31")).toBe(true);
      expect(fileManager.isValidDateString("2025-06-01")).toBe(true);
    });

    it('should reject dates with invalid format (MM/DD/YYYY)', async () => {
      expect(fileManager.isValidDateString("01/15/2024")).toBe(false);
      expect(() => fileManager.validateDateString("01/15/2024")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("01/15/2024")).toThrow(/Invalid date format/);
    });

    it('should reject dates with invalid format (DD-MM-YYYY)', async () => {
      expect(fileManager.isValidDateString("15-01-2024")).toBe(false);
      expect(() => fileManager.validateDateString("15-01-2024")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("15-01-2024")).toThrow(/Invalid date format/);
    });

    it('should reject dates with single digit months', async () => {
      expect(fileManager.isValidDateString("2024-1-15")).toBe(false);
      expect(() => fileManager.validateDateString("2024-1-15")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("2024-1-15")).toThrow(/Invalid date format/);
    });

    it('should reject dates with single digit days', async () => {
      expect(fileManager.isValidDateString("2024-01-5")).toBe(false);
      expect(() => fileManager.validateDateString("2024-01-5")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("2024-01-5")).toThrow(/Invalid date format/);
    });

    it('should reject invalid dates like February 30', async () => {
      expect(() => fileManager.validateDateString("2024-02-30")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("2024-02-30")).toThrow(/Invalid date/);
    });

    it('should handle leap year dates correctly', async () => {
      expect(() => fileManager.validateDateString("2024-02-29")).not.toThrow();
      expect(() => fileManager.validateDateString("2023-02-29")).toThrow(ValidationError);
      expect(() => fileManager.validateDateString("2023-02-29")).toThrow(/Invalid date/);
    });
  });

  describe('Wei Value Validation', () => {
    it('should accept valid decimal string wei values', async () => {
      expect(fileManager.isValidWeiValue("1000000000000000000000")).toBe(true);
      expect(fileManager.isValidWeiValue("0")).toBe(true);
      expect(fileManager.isValidWeiValue("123456789012345678901234567890")).toBe(true);
    });

    it('should reject numeric wei values (not strings)', async () => {
      expect(() => fileManager.validateWeiValue(1000000000000000000000 as any)).toThrow(ValidationError);
      expect(() => fileManager.validateWeiValue(1000000000000000000000 as any)).toThrow(/Wei value must be a string/);
    });

    it('should reject wei values in scientific notation', async () => {
      expect(fileManager.isValidWeiValue("1.23e+21")).toBe(false);
      expect(() => fileManager.validateWeiValue("1.23e+21")).toThrow(ValidationError);
      expect(() => fileManager.validateWeiValue("1.23e+21")).toThrow(/scientific notation/);
    });

    it('should reject negative wei values', async () => {
      expect(fileManager.isValidWeiValue("-1000")).toBe(false);
      expect(() => fileManager.validateWeiValue("-1000")).toThrow(ValidationError);
      expect(() => fileManager.validateWeiValue("-1000")).toThrow(/Wei value cannot be negative/);
    });

    it('should reject wei values with decimal points', async () => {
      expect(fileManager.isValidWeiValue("1000.5")).toBe(false);
      expect(() => fileManager.validateWeiValue("1000.5")).toThrow(ValidationError);
      expect(() => fileManager.validateWeiValue("1000.5")).toThrow(/Wei value must be an integer/);
    });

    it('should accept zero as valid wei value "0"', async () => {
      expect(fileManager.isValidWeiValue("0")).toBe(true);
      expect(() => fileManager.validateWeiValue("0")).not.toThrow();
    });

    it('should handle maximum uint256 wei values', async () => {
      const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
      expect(fileManager.isValidWeiValue(maxUint256)).toBe(true);
      expect(() => fileManager.validateWeiValue(maxUint256)).not.toThrow();
    });
  });

  describe('Block Number Validation', () => {
    it('should accept positive integer block numbers', async () => {
      expect(() => fileManager.validateBlockNumber(12345678)).not.toThrow();
      expect(() => fileManager.validateBlockNumber(1)).not.toThrow();
      expect(() => fileManager.validateBlockNumber(999999999)).not.toThrow();
    });

    it('should reject negative block numbers', async () => {
      expect(() => fileManager.validateBlockNumber(-1)).toThrow(ValidationError);
      expect(() => fileManager.validateBlockNumber(-1)).toThrow(/Block number must be positive/);
    });

    it('should reject zero as block number', async () => {
      expect(() => fileManager.validateBlockNumber(0)).toThrow(ValidationError);
      expect(() => fileManager.validateBlockNumber(0)).toThrow(/Block number must be positive/);
    });

    it('should reject non-integer block numbers', async () => {
      expect(() => fileManager.validateBlockNumber(12345.67)).toThrow(ValidationError);
      expect(() => fileManager.validateBlockNumber(12345.67)).toThrow(/Block number must be an integer/);
    });

    it('should reject string block numbers', async () => {
      expect(() => fileManager.validateBlockNumber("12345678" as any)).toThrow(ValidationError);
      expect(() => fileManager.validateBlockNumber("12345678" as any)).toThrow(/Block number must be a number/);
    });

    it('should handle very large block numbers', async () => {
      expect(() => fileManager.validateBlockNumber(999999999)).not.toThrow();
      expect(() => fileManager.validateBlockNumber(200000000)).not.toThrow();
      expect(() => fileManager.validateBlockNumber(500000000)).not.toThrow();
    });
  });

  describe('Distributor Type Validation', () => {
    it('should accept valid L2_BASE_FEE distributor type', async () => {
      expect(fileManager.isValidDistributorType(DistributorType.L2_BASE_FEE)).toBe(true);
      expect(() => fileManager.validateDistributorType(DistributorType.L2_BASE_FEE)).not.toThrow();
    });

    it('should accept valid L2_SURPLUS_FEE distributor type', async () => {
      expect(fileManager.isValidDistributorType(DistributorType.L2_SURPLUS_FEE)).toBe(true);
      expect(() => fileManager.validateDistributorType(DistributorType.L2_SURPLUS_FEE)).not.toThrow();
    });

    it('should accept valid L1_SURPLUS_FEE distributor type', async () => {
      expect(fileManager.isValidDistributorType(DistributorType.L1_SURPLUS_FEE)).toBe(true);
      expect(() => fileManager.validateDistributorType(DistributorType.L1_SURPLUS_FEE)).not.toThrow();
    });

    it('should reject invalid distributor type "UNKNOWN"', async () => {
      expect(fileManager.isValidDistributorType("UNKNOWN")).toBe(false);
      expect(() => fileManager.validateDistributorType("UNKNOWN")).toThrow(ValidationError);
      expect(() => fileManager.validateDistributorType("UNKNOWN")).toThrow(/Invalid distributor type/);
    });

    it('should reject lowercase distributor types', async () => {
      expect(fileManager.isValidDistributorType("l2_base_fee")).toBe(false);
      expect(() => fileManager.validateDistributorType("l2_base_fee")).toThrow(ValidationError);
    });

    it('should provide helpful error listing all valid types', async () => {
      try {
        fileManager.validateDistributorType("INVALID_TYPE");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const err = error as ValidationError;
        expect(err.message).toContain("L2_BASE_FEE");
        expect(err.message).toContain("L2_SURPLUS_FEE");
        expect(err.message).toContain("L1_SURPLUS_FEE");
        expect(err.message).toContain("L1_BASE_FEE");
      }
    });
  });
});