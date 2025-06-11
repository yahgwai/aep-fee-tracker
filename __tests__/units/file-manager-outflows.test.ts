import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { OutflowData } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Outflow Data Read/Write Operations', () => {
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

  describe('readDistributorOutflows', () => {
    const testAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";

    it('should return empty OutflowData when outflows.json does not exist', async () => {
      const result = await fileManager.readDistributorOutflows(testAddress);
      
      expect(result).toEqual({
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {}
      });
    });

    it('should create distributor directory when writing outflows for new address', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "1000000000000000000000",
            events: [{
              recipient: "0xRecipient0000000000000000000000000000001",
              value_wei: "1000000000000000000000",
              tx_hash: "0xabc123"
            }]
          }
        }
      };

      const dirPath = path.join('store', 'distributors', testAddress.toLowerCase());
      expect(fs.existsSync(dirPath)).toBe(false);

      await fileManager.writeDistributorOutflows(testAddress, testData);
      
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it('should write and read back OutflowData with multiple events per day', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "15000000000000000000000",
            events: [
              {
                recipient: "0xRecipient0000000000000000000000000000001",
                value_wei: "5000000000000000000000",
                tx_hash: "0xabc12345678901234567890123456789012345678901234567890123456789012"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000002",
                value_wei: "3000000000000000000000",
                tx_hash: "0xdef45678901234567890123456789012345678901234567890123456789012345"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000003",
                value_wei: "2000000000000000000000",
                tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000004",
                value_wei: "1000000000000000000000",
                tx_hash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000005",
                value_wei: "1500000000000000000000",
                tx_hash: "0xbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000006",
                value_wei: "800000000000000000000",
                tx_hash: "0xcafe1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000007",
                value_wei: "700000000000000000000",
                tx_hash: "0xdead1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000008",
                value_wei: "600000000000000000000",
                tx_hash: "0xfeed1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000009",
                value_wei: "500000000000000000000",
                tx_hash: "0xbabe1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000010",
                value_wei: "900000000000000000000",
                tx_hash: "0xface1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
              }
            ]
          }
        }
      };

      await fileManager.writeDistributorOutflows(testAddress, testData);
      const result = await fileManager.readDistributorOutflows(testAddress);
      
      expect(result.outflows['2024-01-15'].events).toHaveLength(10);
      expect(result.outflows['2024-01-15'].total_outflow_wei).toBe("15000000000000000000000");
      expect(result).toEqual(testData);
    });

    it('should preserve event order within daily arrays', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "10000000000000000000000",
            events: [
              {
                recipient: "0xAAAAA00000000000000000000000000000000001",
                value_wei: "1000000000000000000000",
                tx_hash: "0xabc123"
              },
              {
                recipient: "0xBBBBB00000000000000000000000000000000002",
                value_wei: "2000000000000000000000",
                tx_hash: "0xdef456"
              },
              {
                recipient: "0xCCCCC00000000000000000000000000000000003",
                value_wei: "3000000000000000000000",
                tx_hash: "0xghi789"
              },
              {
                recipient: "0xDDDDD00000000000000000000000000000000004",
                value_wei: "4000000000000000000000",
                tx_hash: "0xjkl012"
              }
            ]
          }
        }
      };

      await fileManager.writeDistributorOutflows(testAddress, testData);
      const result = await fileManager.readDistributorOutflows(testAddress);
      
      const events = result.outflows['2024-01-15'].events;
      expect(events[0].recipient).toBe("0xAAAAA00000000000000000000000000000000001");
      expect(events[1].recipient).toBe("0xBBBBB00000000000000000000000000000000002");
      expect(events[2].recipient).toBe("0xCCCCC00000000000000000000000000000000003");
      expect(events[3].recipient).toBe("0xDDDDD00000000000000000000000000000000004");
    });

    it('should handle days with no events (empty events array)', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "0",
            events: []
          },
          '2024-01-16': {
            block_number: 12356789,
            total_outflow_wei: "1000000000000000000000",
            events: [{
              recipient: "0xRecipient0000000000000000000000000000001",
              value_wei: "1000000000000000000000",
              tx_hash: "0xabc123"
            }]
          },
          '2024-01-17': {
            block_number: 12367890,
            total_outflow_wei: "0",
            events: []
          }
        }
      };

      await fileManager.writeDistributorOutflows(testAddress, testData);
      const result = await fileManager.readDistributorOutflows(testAddress);
      
      expect(result.outflows['2024-01-15'].events).toEqual([]);
      expect(result.outflows['2024-01-15'].total_outflow_wei).toBe("0");
      expect(result.outflows['2024-01-17'].events).toEqual([]);
      expect(result.outflows['2024-01-17'].total_outflow_wei).toBe("0");
    });

    it('should calculate and store total_outflow_wei correctly', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: testAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "6500000000000000000000",
            events: [
              {
                recipient: "0xRecipient0000000000000000000000000000001",
                value_wei: "1500000000000000000000",
                tx_hash: "0xabc123"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000002",
                value_wei: "2000000000000000000000",
                tx_hash: "0xdef456"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000003",
                value_wei: "3000000000000000000000",
                tx_hash: "0xghi789"
              }
            ]
          }
        }
      };

      await fileManager.writeDistributorOutflows(testAddress, testData);
      const result = await fileManager.readDistributorOutflows(testAddress);
      
      const totalFromEvents = result.outflows['2024-01-15'].events
        .reduce((sum: bigint, event: any) => sum + BigInt(event.value_wei), BigInt(0));
      
      expect(totalFromEvents.toString()).toBe("6500000000000000000000");
      expect(result.outflows['2024-01-15'].total_outflow_wei).toBe("6500000000000000000000");
    });
  });
});