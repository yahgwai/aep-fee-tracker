// ABOUTME: Tests for FileManager validation methods
// ABOUTME: Covers address checksumming, date formatting, and input validation

import { FileManager } from '../src/file-manager';
import { ValidationError } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileManager - Validation', () => {
  let testDir: string;
  let fileManager: FileManager;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-manager-test-'));
    process.chdir(testDir);
    fileManager = new FileManager();
  });

  afterEach(() => {
    process.chdir('/');
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Address Validation', () => {
    it('should checksum lowercase addresses before storing', () => {
      const lowercase = '0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9';
      const checksummed = fileManager.validateAddress(lowercase);
      
      expect(checksummed).toBe('0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9');
    });

    it('should accept already checksummed addresses', () => {
      const checksummed = '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9';
      const result = fileManager.validateAddress(checksummed);
      
      expect(result).toBe(checksummed);
    });

    it('should reject addresses shorter than 42 characters', () => {
      expect(() => {
        fileManager.validateAddress('0x123');
      }).toThrow(ValidationError);
    });

    it('should reject addresses longer than 42 characters', () => {
      expect(() => {
        fileManager.validateAddress('0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9ABC');
      }).toThrow(ValidationError);
    });

    it('should reject addresses with invalid characters', () => {
      expect(() => {
        fileManager.validateAddress('0xGGGG4CE4321aB3aF51c2D0a4801c3E111D88C9d9');
      }).toThrow(ValidationError);
    });

    it('should reject addresses that don\'t start with 0x', () => {
      expect(() => {
        fileManager.validateAddress('67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9');
      }).toThrow(ValidationError);
    });

    it('should provide specific error for invalid checksum', () => {
      try {
        fileManager.validateAddress('0x67A24CE4321aB3aF51c2D0a4801c3E111D88C9d9');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('checksum');
      }
    });
  });

  describe('Date Formatting', () => {
    it('should format dates as YYYY-MM-DD in UTC', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const formatted = fileManager.formatDate(date);
      
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle dates at UTC boundaries correctly', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-15T23:59:59Z');
      
      expect(fileManager.formatDate(date1)).toBe('2024-01-15');
      expect(fileManager.formatDate(date2)).toBe('2024-01-15');
    });

    it('should handle different timezones by converting to UTC', () => {
      const date = new Date('2024-01-15T20:00:00-05:00'); // EST
      const formatted = fileManager.formatDate(date);
      
      expect(formatted).toBe('2024-01-16'); // Next day in UTC
    });
  });

  describe('Date Validation', () => {
    it('should accept valid YYYY-MM-DD format dates', async () => {
      const validDates = ['2024-01-15', '2024-12-31', '2024-02-29', '2023-02-28'];
      
      for (const date of validDates) {
        await expect(fileManager.writeBlockNumbers({
          metadata: { chain_id: 42161 },
          blocks: { [date]: 12345678 }
        })).resolves.not.toThrow();
      }
    });

    it('should reject dates with invalid format (MM/DD/YYYY)', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '01/15/2024': 12345678 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject dates with invalid format (DD-MM-YYYY)', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '15-01-2024': 12345678 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject dates with single digit months', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-1-15': 12345678 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject dates with single digit days', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-5': 12345678 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject invalid dates like February 30', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-02-30': 12345678 }
      })).rejects.toThrow(ValidationError);
    });

    it('should handle leap year dates correctly', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-02-29': 12345678 }
      })).resolves.not.toThrow();

      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2023-02-29': 12345678 }
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('Wei Value Validation', () => {
    const testAddress = '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9';

    it('should accept valid decimal string wei values', async () => {
      const validValues = ['0', '1000000000000000000000', '999999999999999999999'];
      
      for (const value of validValues) {
        await expect(fileManager.writeDistributorBalances(testAddress, {
          metadata: { chain_id: 42161, reward_distributor: testAddress },
          balances: { '2024-01-15': { block_number: 12345678, balance_wei: value } }
        })).resolves.not.toThrow();
      }
    });

    it('should reject numeric wei values (not strings)', async () => {
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: 1000 as any } }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject wei values in scientific notation', async () => {
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: '1.23e+21' } }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject negative wei values', async () => {
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: '-1000' } }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject wei values with decimal points', async () => {
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: '1000.5' } }
      })).rejects.toThrow(ValidationError);
    });

    it('should accept zero as valid wei value "0"', async () => {
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: '0' } }
      })).resolves.not.toThrow();
    });

    it('should handle maximum uint256 wei values', async () => {
      const maxUint256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      
      await expect(fileManager.writeDistributorBalances(testAddress, {
        metadata: { chain_id: 42161, reward_distributor: testAddress },
        balances: { '2024-01-15': { block_number: 12345678, balance_wei: maxUint256 } }
      })).resolves.not.toThrow();
    });
  });

  describe('Block Number Validation', () => {
    it('should accept positive integer block numbers', async () => {
      const validNumbers = [1, 12345678, 999999999];
      
      for (const num of validNumbers) {
        await expect(fileManager.writeBlockNumbers({
          metadata: { chain_id: 42161 },
          blocks: { '2024-01-15': num }
        })).resolves.not.toThrow();
      }
    });

    it('should reject negative block numbers', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': -1 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject zero as block number', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 0 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject non-integer block numbers', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345.67 }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject string block numbers', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': '12345678' as any }
      })).rejects.toThrow(ValidationError);
    });

    it('should handle very large block numbers', async () => {
      await expect(fileManager.writeBlockNumbers({
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 999999999 }
      })).resolves.not.toThrow();
    });
  });

  describe('Distributor Type Validation', () => {
    it('should accept valid L2_BASE_FEE distributor type', async () => {
      await expect(fileManager.writeDistributors({
        metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
        distributors: {
          '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
            type: 'L2_BASE_FEE' as any,
            discovered_block: 12345678,
            discovered_date: '2024-01-15',
            tx_hash: '0xabc',
            method: '0xee95a824',
            owner: '0x0000000000000000000000000000000000000070',
            event_data: '0x123'
          }
        }
      })).resolves.not.toThrow();
    });

    it('should accept valid L2_SURPLUS_FEE distributor type', async () => {
      await expect(fileManager.writeDistributors({
        metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
        distributors: {
          '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
            type: 'L2_SURPLUS_FEE' as any,
            discovered_block: 12345678,
            discovered_date: '2024-01-15',
            tx_hash: '0xabc',
            method: '0x2d9125e9',
            owner: '0x0000000000000000000000000000000000000070',
            event_data: '0x123'
          }
        }
      })).resolves.not.toThrow();
    });

    it('should accept valid L1_SURPLUS_FEE distributor type', async () => {
      await expect(fileManager.writeDistributors({
        metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
        distributors: {
          '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
            type: 'L1_SURPLUS_FEE' as any,
            discovered_block: 12345678,
            discovered_date: '2024-01-15',
            tx_hash: '0xabc',
            method: '0x934be07d',
            owner: '0x0000000000000000000000000000000000000070',
            event_data: '0x123'
          }
        }
      })).resolves.not.toThrow();
    });

    it('should reject invalid distributor type "UNKNOWN"', async () => {
      await expect(fileManager.writeDistributors({
        metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
        distributors: {
          '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
            type: 'UNKNOWN' as any,
            discovered_block: 12345678,
            discovered_date: '2024-01-15',
            tx_hash: '0xabc',
            method: '0x123',
            owner: '0x0000000000000000000000000000000000000070',
            event_data: '0x123'
          }
        }
      })).rejects.toThrow(ValidationError);
    });

    it('should reject lowercase distributor types', async () => {
      await expect(fileManager.writeDistributors({
        metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
        distributors: {
          '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
            type: 'l2_base_fee' as any,
            discovered_block: 12345678,
            discovered_date: '2024-01-15',
            tx_hash: '0xabc',
            method: '0xee95a824',
            owner: '0x0000000000000000000000000000000000000070',
            event_data: '0x123'
          }
        }
      })).rejects.toThrow(ValidationError);
    });

    it('should provide helpful error listing all valid types', async () => {
      try {
        await fileManager.writeDistributors({
          metadata: { chain_id: 42161, arbowner_address: '0x0000000000000000000000000000000000000070' },
          distributors: {
            '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
              type: 'INVALID' as any,
              discovered_block: 12345678,
              discovered_date: '2024-01-15',
              tx_hash: '0xabc',
              method: '0x123',
              owner: '0x0000000000000000000000000000000000000070',
              event_data: '0x123'
            }
          }
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('L2_BASE_FEE');
        expect((error as ValidationError).message).toContain('L2_SURPLUS_FEE');
        expect((error as ValidationError).message).toContain('L1_SURPLUS_FEE');
      }
    });
  });
});