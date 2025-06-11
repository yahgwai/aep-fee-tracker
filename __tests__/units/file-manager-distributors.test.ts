import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { DistributorsData, DistributorType } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Distributors Read/Write Operations', () => {
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

  describe('readDistributors', () => {
    it('should return empty DistributorsData when distributors.json does not exist', async () => {
      const result = await fileManager.readDistributors();
      
      expect(result).toEqual({
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {}
      });
    });

    it('should write and read back DistributorsData with multiple distributors', async () => {
      const testData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc12345678901234567890123456789012345678901234567890123456789012",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          },
          "0x1234567890123456789012345678901234567890": {
            type: DistributorType.L2_SURPLUS_FEE,
            discovered_block: 15678901,
            discovered_date: "2024-06-01",
            tx_hash: "0xdef45678901234567890123456789012345678901234567890123456789012345",
            method: "0x2d9125e9",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x0000000000000000000000001234567890123456789012345678901234567890"
          },
          "0xABcDEF0123456789012345678901234567890123": {
            type: DistributorType.L1_SURPLUS_FEE,
            discovered_block: 20000000,
            discovered_date: "2024-07-15",
            tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x000000000000000000000000abcdef0123456789012345678901234567890123"
          },
          "0x9876543210987654321098765432109876543210": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 25000000,
            discovered_date: "2024-08-01",
            tx_hash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x0000000000000000000000009876543210987654321098765432109876543210"
          },
          "0xDeadBeef00000000000000000000000000000000": {
            type: DistributorType.L2_SURPLUS_FEE,
            discovered_block: 30000000,
            discovered_date: "2024-09-01",
            tx_hash: "0xbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
            method: "0x2d9125e9",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x000000000000000000000000deadbeef00000000000000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributors(testData);
      const result = await fileManager.readDistributors();
      
      expect(result).toEqual(testData);
      expect(Object.keys(result.distributors)).toHaveLength(5);
    });

    it('should preserve all distributor metadata fields', async () => {
      const testData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc12345678901234567890123456789012345678901234567890123456789012",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          }
        }
      };

      await fileManager.writeDistributors(testData);
      const result = await fileManager.readDistributors();
      
      const distributor = result.distributors["0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"];
      expect(distributor.type).toBe(DistributorType.L2_BASE_FEE);
      expect(distributor.discovered_block).toBe(12345678);
      expect(distributor.discovered_date).toBe("2024-01-15");
      expect(distributor.tx_hash).toBe("0xabc12345678901234567890123456789012345678901234567890123456789012");
      expect(distributor.method).toBe("0xee95a824");
      expect(distributor.owner).toBe("0x0000000000000000000000000000000000000070");
      expect(distributor.event_data).toBe("0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9");
    });

    it('should maintain distributor addresses as object keys', async () => {
      const testData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc123",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          },
          "0xaBcDeF0123456789012345678901234567890123": {
            type: DistributorType.L1_SURPLUS_FEE,
            discovered_block: 23456789,
            discovered_date: "2024-02-01",
            tx_hash: "0xdef456",
            method: "0x934be07d",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x000000000000000000000000abcdef0123456789012345678901234567890123"
          }
        }
      };

      await fileManager.writeDistributors(testData);
      const result = await fileManager.readDistributors();
      
      const addresses = Object.keys(result.distributors);
      expect(addresses).toContain("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
      expect(addresses).toContain("0xaBcDeF0123456789012345678901234567890123");
      expect(addresses).toHaveLength(2);
    });

    it('should handle distributors with very long event_data hex strings', async () => {
      const longEventData = "0x" + "a".repeat(512);
      
      const testData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc12345678901234567890123456789012345678901234567890123456789012",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: longEventData
          }
        }
      };

      await fileManager.writeDistributors(testData);
      const result = await fileManager.readDistributors();
      
      const distributor = result.distributors["0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"];
      expect(distributor.event_data).toBe(longEventData);
      expect(distributor.event_data.length).toBe(514);
    });
  });
});