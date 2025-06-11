import { FileManager } from '../src/file-manager';
import { OutflowData, CHAIN_IDS } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileManager - Outflow Data Read/Write Operations', () => {
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

  it('should return empty OutflowData when outflows.json does not exist', async () => {
    const result = await fileManager.readDistributorOutflows(testAddress);
    
    expect(result).toEqual({
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {}
    });
  });

  it('should create distributor directory when writing outflows for new address', async () => {
    const testData: OutflowData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {
        '2024-01-15': {
          block_number: 12345678,
          total_outflow_wei: '0',
          events: []
        }
      }
    };

    await fileManager.writeDistributorOutflows(testAddress, testData);
    
    const dirPath = path.join('store', 'distributors', testAddress);
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('should write and read back OutflowData with multiple events per day', async () => {
    const testData: OutflowData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {
        '2024-01-15': {
          block_number: 12345678,
          total_outflow_wei: '4500000000000000000000',
          events: [
            {
              recipient: '0xAAA1234567890123456789012345678901234567',
              value_wei: '1500000000000000000000',
              tx_hash: '0xdef123456789012345678901234567890123456789012345678901234567890'
            },
            {
              recipient: '0xBBB1234567890123456789012345678901234567',
              value_wei: '2000000000000000000000',
              tx_hash: '0xabc123456789012345678901234567890123456789012345678901234567890'
            },
            {
              recipient: '0xCCC1234567890123456789012345678901234567',
              value_wei: '500000000000000000000',
              tx_hash: '0x123456789012345678901234567890123456789012345678901234567890abc'
            },
            {
              recipient: '0xDDD1234567890123456789012345678901234567',
              value_wei: '500000000000000000000',
              tx_hash: '0x456789012345678901234567890123456789012345678901234567890123def'
            }
          ]
        },
        '2024-01-16': {
          block_number: 12345779,
          total_outflow_wei: '10000000000000000000000',
          events: Array(10).fill(null).map((_, i) => ({
            recipient: `0x${i.toString(16).padStart(3, '0')}1234567890123456789012345678901234567`,
            value_wei: '1000000000000000000000',
            tx_hash: `0x${i.toString(16).padStart(64, '0')}`
          }))
        }
      }
    };

    await fileManager.writeDistributorOutflows(testAddress, testData);
    const result = await fileManager.readDistributorOutflows(testAddress);

    expect(result).toEqual(testData);
    expect(result.outflows['2024-01-15'].events).toHaveLength(4);
    expect(result.outflows['2024-01-16'].events).toHaveLength(10);
  });

  it('should preserve event order within daily arrays', async () => {
    const events = [
      {
        recipient: '0xZZZ1234567890123456789012345678901234567',
        value_wei: '100',
        tx_hash: '0xfff'
      },
      {
        recipient: '0xAAA1234567890123456789012345678901234567',
        value_wei: '200',
        tx_hash: '0xaaa'
      },
      {
        recipient: '0xMMM1234567890123456789012345678901234567',
        value_wei: '300',
        tx_hash: '0xmmm'
      }
    ];

    const testData: OutflowData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {
        '2024-01-15': {
          block_number: 12345678,
          total_outflow_wei: '600',
          events: events
        }
      }
    };

    await fileManager.writeDistributorOutflows(testAddress, testData);
    const result = await fileManager.readDistributorOutflows(testAddress);

    expect(result.outflows['2024-01-15'].events).toEqual(events);
  });

  it('should handle days with no events (empty events array)', async () => {
    const testData: OutflowData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {
        '2024-01-15': {
          block_number: 12345678,
          total_outflow_wei: '0',
          events: []
        }
      }
    };

    await fileManager.writeDistributorOutflows(testAddress, testData);
    const result = await fileManager.readDistributorOutflows(testAddress);

    expect(result.outflows['2024-01-15'].events).toEqual([]);
    expect(result.outflows['2024-01-15'].total_outflow_wei).toBe('0');
  });

  it('should calculate and store total_outflow_wei correctly', async () => {
    const testData: OutflowData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: testAddress
      },
      outflows: {
        '2024-01-15': {
          block_number: 12345678,
          total_outflow_wei: '6000000000000000000000',
          events: [
            {
              recipient: '0xAAA1234567890123456789012345678901234567',
              value_wei: '1000000000000000000000',
              tx_hash: '0xaaa'
            },
            {
              recipient: '0xBBB1234567890123456789012345678901234567',
              value_wei: '2000000000000000000000',
              tx_hash: '0xbbb'
            },
            {
              recipient: '0xCCC1234567890123456789012345678901234567',
              value_wei: '3000000000000000000000',
              tx_hash: '0xccc'
            }
          ]
        }
      }
    };

    await fileManager.writeDistributorOutflows(testAddress, testData);
    const result = await fileManager.readDistributorOutflows(testAddress);

    expect(result.outflows['2024-01-15'].total_outflow_wei).toBe('6000000000000000000000');
    
    // Verify sum matches
    const sum = result.outflows['2024-01-15'].events.reduce(
      (acc: bigint, event: any) => acc + BigInt(event.value_wei), 
      BigInt(0)
    );
    expect(sum.toString()).toBe('6000000000000000000000');
  });
});