import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { BalanceData } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Balance Data Read/Write Operations', () => {
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

  describe('readDistributorBalances', () => {
    const testAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";

    it('should return empty BalanceData when balances.json does not exist', async () => {
      const result = await fileManager.readDistributorBalances(testAddress);
      
      expect(result).toEqual({
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {}
      });
    });

    it('should create distributor directory when writing balances for new address', async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          }
        }
      };

      const dirPath = path.join('store', 'distributors', testAddress.toLowerCase());
      expect(fs.existsSync(dirPath)).toBe(false);

      await fileManager.writeDistributorBalances(testAddress, testData);
      
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it('should write and read back BalanceData with many dates', async () => {
      const balances: { [date: string]: { block_number: number; balance_wei: string } } = {};
      
      const startDate = new Date('2023-01-01');
      for (let i = 0; i < 400; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        balances[dateStr] = {
          block_number: 10000000 + i * 1000,
          balance_wei: `${1000 + i}000000000000000000`
        };
      }

      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances
      };

      await fileManager.writeDistributorBalances(testAddress, testData);
      const result = await fileManager.readDistributorBalances(testAddress);
      
      expect(Object.keys(result.balances)).toHaveLength(400);
      expect(result.balances['2023-01-01']).toEqual({
        block_number: 10000000,
        balance_wei: "1000000000000000000000"
      });
      expect(result.balances['2024-02-04']).toEqual({
        block_number: 10399000,
        balance_wei: "1399000000000000000000"
      });
    });

    it('should preserve wei values as strings without modification', async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          },
          '2024-01-16': {
            block_number: 12356789,
            balance_wei: "999999999999999999999"
          },
          '2024-01-17': {
            block_number: 12367890,
            balance_wei: "123456789012345678901234567890"
          }
        }
      };

      await fileManager.writeDistributorBalances(testAddress, testData);
      const result = await fileManager.readDistributorBalances(testAddress);
      
      expect(result.balances['2024-01-15'].balance_wei).toBe("1000000000000000000000");
      expect(result.balances['2024-01-16'].balance_wei).toBe("999999999999999999999");
      expect(result.balances['2024-01-17'].balance_wei).toBe("123456789012345678901234567890");
      expect(typeof result.balances['2024-01-15'].balance_wei).toBe('string');
    });

    it('should handle balance of 0 correctly', async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "0"
          },
          '2024-01-16': {
            block_number: 12356789,
            balance_wei: "1000000000000000000000"
          },
          '2024-01-17': {
            block_number: 12367890,
            balance_wei: "0"
          }
        }
      };

      await fileManager.writeDistributorBalances(testAddress, testData);
      const result = await fileManager.readDistributorBalances(testAddress);
      
      expect(result.balances['2024-01-15'].balance_wei).toBe("0");
      expect(result.balances['2024-01-17'].balance_wei).toBe("0");
      expect(typeof result.balances['2024-01-15'].balance_wei).toBe('string');
    });

    it('should update existing balance file with new dates', async () => {
      const initialData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          },
          '2024-01-16': {
            block_number: 12356789,
            balance_wei: "2000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributorBalances(testAddress, initialData);
      
      const updatedData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          },
          '2024-01-16': {
            block_number: 12356789,
            balance_wei: "2000000000000000000000"
          },
          '2024-01-17': {
            block_number: 12367890,
            balance_wei: "3000000000000000000000"
          },
          '2024-01-18': {
            block_number: 12378901,
            balance_wei: "4000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributorBalances(testAddress, updatedData);
      const result = await fileManager.readDistributorBalances(testAddress);
      
      expect(Object.keys(result.balances)).toHaveLength(4);
      expect(result.balances['2024-01-15'].balance_wei).toBe("1000000000000000000000");
      expect(result.balances['2024-01-16'].balance_wei).toBe("2000000000000000000000");
      expect(result.balances['2024-01-17'].balance_wei).toBe("3000000000000000000000");
      expect(result.balances['2024-01-18'].balance_wei).toBe("4000000000000000000000");
    });
  });
});