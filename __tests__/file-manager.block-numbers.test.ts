// ABOUTME: Tests for FileManager block number read/write operations
// ABOUTME: Covers empty file handling, data persistence, and JSON formatting

import { FileManager } from '../src/file-manager';
import { BlockNumberData, CHAIN_IDS } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileManager - Block Numbers Read/Write Operations', () => {
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

  it('should return empty BlockNumberData when block_numbers.json does not exist', async () => {
    const result = await fileManager.readBlockNumbers();
    
    expect(result).toEqual({
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {}
    });
  });

  it('should write and read back BlockNumberData with multiple date entries', async () => {
    const testData: BlockNumberData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {
        '2024-01-15': 12345678,
        '2024-01-16': 12356789,
        '2024-01-17': 12367890
      }
    };

    await fileManager.writeBlockNumbers(testData);
    const result = await fileManager.readBlockNumbers();

    expect(result).toEqual(testData);
  });

  it('should preserve block number precision for large block numbers', async () => {
    const testData: BlockNumberData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {
        '2024-01-15': 200000000,
        '2024-01-16': 250000000,
        '2024-01-17': 999999999
      }
    };

    await fileManager.writeBlockNumbers(testData);
    const result = await fileManager.readBlockNumbers();

    expect(result.blocks['2024-01-15']).toBe(200000000);
    expect(result.blocks['2024-01-16']).toBe(250000000);
    expect(result.blocks['2024-01-17']).toBe(999999999);
  });

  it('should format JSON with 2-space indentation for human readability', async () => {
    const testData: BlockNumberData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {
        '2024-01-15': 12345678
      }
    };

    await fileManager.writeBlockNumbers(testData);
    const fileContent = fs.readFileSync('store/block_numbers.json', 'utf-8');

    expect(fileContent).toBe(JSON.stringify(testData, null, 2));
    expect(fileContent).toContain('  "metadata"');
    expect(fileContent).toContain('    "chain_id"');
  });

  it('should maintain date ordering in blocks object', async () => {
    const testData: BlockNumberData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {
        '2024-01-17': 12367890,
        '2024-01-15': 12345678,
        '2024-01-16': 12356789
      }
    };

    await fileManager.writeBlockNumbers(testData);
    const result = await fileManager.readBlockNumbers();

    const dates = Object.keys(result.blocks);
    expect(dates).toEqual(['2024-01-17', '2024-01-15', '2024-01-16']);
  });

  it('should handle single date entry correctly', async () => {
    const testData: BlockNumberData = {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE
      },
      blocks: {
        '2024-01-15': 12345678
      }
    };

    await fileManager.writeBlockNumbers(testData);
    const result = await fileManager.readBlockNumbers();

    expect(result).toEqual(testData);
    expect(Object.keys(result.blocks)).toHaveLength(1);
  });
});