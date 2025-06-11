import { FileManager } from '../src/file-manager';
import { BalanceData, CHAIN_IDS } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileManager - Balance Data Read/Write Operations', () => {
  let testDir: string;
  let fileManager: FileManager;
  const testAddress = '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9';

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-manager-test-'));
    process.chdir(testDir);
    fileManager = new FileManager();
  });

  afterEach(() => {
    process.chdir('/');
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty BalanceData when balances.json does not exist', async () => {
    const result = await fileManager.readDistributorBalances(testAddress);
    
    expect(result).toEqual({
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {}
    });
  });

  it('should create distributor directory when writing balances for new address', async () => {
    const testData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {
        '2024-01-15': {
          block_number: 12345678,
          balance_wei: '1000000000000000000000'
        }
      }
    };

    await fileManager.writeDistributorBalances(testAddress, testData);
    
    const dirPath = path.join('store', 'distributors', testAddress);
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('should write and read back BalanceData with many dates', async () => {
    const testData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {}
    };

    // Generate 365 days of balance data
    const startDate = new Date('2024-01-01T00:00:00Z');
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      testData.balances[dateStr] = {
        block_number: 12345678 + i * 100,
        balance_wei: `${1000 + i}000000000000000000`
      };
    }

    await fileManager.writeDistributorBalances(testAddress, testData);
    const result = await fileManager.readDistributorBalances(testAddress);

    expect(result).toEqual(testData);
    expect(Object.keys(result.balances)).toHaveLength(365);
  });

  it('should preserve wei values as strings without modification', async () => {
    const testData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {
        '2024-01-15': {
          block_number: 12345678,
          balance_wei: '1000000000000000000000'
        },
        '2024-01-16': {
          block_number: 12345679,
          balance_wei: '999999999999999999999'
        },
        '2024-01-17': {
          block_number: 12345680,
          balance_wei: '1234567890123456789012345678901234567890'
        }
      }
    };

    await fileManager.writeDistributorBalances(testAddress, testData);
    const result = await fileManager.readDistributorBalances(testAddress);

    expect(result.balances['2024-01-15'].balance_wei).toBe('1000000000000000000000');
    expect(result.balances['2024-01-16'].balance_wei).toBe('999999999999999999999');
    expect(result.balances['2024-01-17'].balance_wei).toBe('1234567890123456789012345678901234567890');
    expect(typeof result.balances['2024-01-15'].balance_wei).toBe('string');
  });

  it('should handle balance of 0 correctly', async () => {
    const testData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {
        '2024-01-15': {
          block_number: 12345678,
          balance_wei: '0'
        }
      }
    };

    await fileManager.writeDistributorBalances(testAddress, testData);
    const result = await fileManager.readDistributorBalances(testAddress);

    expect(result.balances['2024-01-15'].balance_wei).toBe('0');
    expect(typeof result.balances['2024-01-15'].balance_wei).toBe('string');
  });

  it('should update existing balance file with new dates', async () => {
    const initialData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {
        '2024-01-15': {
          block_number: 12345678,
          balance_wei: '1000000000000000000000'
        }
      }
    };

    await fileManager.writeDistributorBalances(testAddress, initialData);

    const updatedData: BalanceData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      balances: {
        '2024-01-15': {
          block_number: 12345678,
          balance_wei: '1000000000000000000000'
        },
        '2024-01-16': {
          block_number: 12345779,
          balance_wei: '2000000000000000000000'
        }
      }
    };

    await fileManager.writeDistributorBalances(testAddress, updatedData);
    const result = await fileManager.readDistributorBalances(testAddress);

    expect(Object.keys(result.balances)).toHaveLength(2);
    expect(result.balances['2024-01-15']).toEqual(initialData.balances['2024-01-15']);
    expect(result.balances['2024-01-16']).toEqual(updatedData.balances['2024-01-16']);
  });
});