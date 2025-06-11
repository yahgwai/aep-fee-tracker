import { FileManager } from '../src/file-manager';
import { DistributorsData, DistributorType, CONTRACTS, CHAIN_IDS } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileManager - Distributors Read/Write Operations', () => {
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

  it('should return empty DistributorsData when distributors.json does not exist', async () => {
    const result = await fileManager.readDistributors();
    
    expect(result).toEqual({
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER
      },
      distributors: {}
    });
  });

  it('should write and read back DistributorsData with multiple distributors', async () => {
    const testData: DistributorsData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER
      },
      distributors: {
        '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
          type: DistributorType.L2_BASE_FEE,
          discovered_block: 12345678,
          discovered_date: '2024-01-15',
          tx_hash: '0xabc123def456789',
          method: '0xee95a824',
          owner: CONTRACTS.ARB_OWNER,
          event_data: '0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9'
        },
        '0x1234567890123456789012345678901234567890': {
          type: DistributorType.L2_SURPLUS_FEE,
          discovered_block: 15678901,
          discovered_date: '2024-06-01',
          tx_hash: '0xdef456abc789012',
          method: '0x2d9125e9',
          owner: CONTRACTS.ARB_OWNER,
          event_data: '0x0000000000000000000000001234567890123456789012345678901234567890'
        },
        '0xABCDEF1234567890123456789012345678901234': {
          type: DistributorType.L1_SURPLUS_FEE,
          discovered_block: 18901234,
          discovered_date: '2024-09-15',
          tx_hash: '0x789012def345678',
          method: '0x934be07d',
          owner: CONTRACTS.ARB_OWNER,
          event_data: '0x000000000000000000000000abcdef1234567890123456789012345678901234'
        }
      }
    };

    await fileManager.writeDistributors(testData);
    const result = await fileManager.readDistributors();

    expect(result).toEqual(testData);
    expect(Object.keys(result.distributors)).toHaveLength(3);
  });

  it('should preserve all distributor metadata fields', async () => {
    const testData: DistributorsData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER
      },
      distributors: {
        '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
          type: DistributorType.L2_BASE_FEE,
          discovered_block: 12345678,
          discovered_date: '2024-01-15',
          tx_hash: '0xabc123def456789012345678901234567890abcdef123456789012345678',
          method: '0xee95a824',
          owner: CONTRACTS.ARB_OWNER,
          event_data: '0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9'
        }
      }
    };

    await fileManager.writeDistributors(testData);
    const result = await fileManager.readDistributors();

    const distributor = result.distributors['0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9'];
    expect(distributor.type).toBe(DistributorType.L2_BASE_FEE);
    expect(distributor.discovered_block).toBe(12345678);
    expect(distributor.discovered_date).toBe('2024-01-15');
    expect(distributor.tx_hash).toBe('0xabc123def456789012345678901234567890abcdef123456789012345678');
    expect(distributor.method).toBe('0xee95a824');
    expect(distributor.owner).toBe(CONTRACTS.ARB_OWNER);
    expect(distributor.event_data).toBe('0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9');
  });

  it('should maintain distributor addresses as object keys', async () => {
    const addresses = [
      '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9',
      '0x1234567890123456789012345678901234567890',
      '0xABCDEF1234567890123456789012345678901234'
    ];

    const testData: DistributorsData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER
      },
      distributors: {}
    };

    addresses.forEach((addr, i) => {
      testData.distributors[addr] = {
        type: DistributorType.L2_BASE_FEE,
        discovered_block: 12345678 + i,
        discovered_date: '2024-01-15',
        tx_hash: `0xabc${i}`,
        method: '0xee95a824',
        owner: CONTRACTS.ARB_OWNER,
        event_data: `0x${addr.slice(2).toLowerCase().padStart(64, '0')}`
      };
    });

    await fileManager.writeDistributors(testData);
    const result = await fileManager.readDistributors();

    expect(Object.keys(result.distributors)).toEqual(addresses);
  });

  it('should handle distributors with very long event_data hex strings', async () => {
    const longEventData = '0x' + 'a'.repeat(256);
    
    const testData: DistributorsData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER
      },
      distributors: {
        '0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9': {
          type: DistributorType.L2_BASE_FEE,
          discovered_block: 12345678,
          discovered_date: '2024-01-15',
          tx_hash: '0xabc123',
          method: '0xee95a824',
          owner: CONTRACTS.ARB_OWNER,
          event_data: longEventData
        }
      }
    };

    await fileManager.writeDistributors(testData);
    const result = await fileManager.readDistributors();

    expect(result.distributors['0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9'].event_data).toBe(longEventData);
  });
});