import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { BlockNumberData } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Block Numbers Read/Write Operations', () => {
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

  describe('readBlockNumbers', () => {
    it('should return empty BlockNumberData when block_numbers.json does not exist', async () => {
      const result = await fileManager.readBlockNumbers();
      
      expect(result).toEqual({
        metadata: {
          chain_id: 42161
        },
        blocks: {}
      });
    });

    it('should write and read back BlockNumberData with multiple date entries', async () => {
      const testData: BlockNumberData = {
        metadata: {
          chain_id: 42161
        },
        blocks: {
          '2024-01-15': 12345678,
          '2024-01-16': 12356789,
          '2024-01-17': 12367890,
          '2024-01-18': 12378901,
          '2024-01-19': 12389012
        }
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();
      
      expect(result).toEqual(testData);
    });

    it('should preserve block number precision for large block numbers', async () => {
      const testData: BlockNumberData = {
        metadata: {
          chain_id: 42161
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
          chain_id: 42161
        },
        blocks: {
          '2024-01-15': 12345678
        }
      };

      await fileManager.writeBlockNumbers(testData);
      
      const filePath = path.join('store', 'block_numbers.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      expect(fileContent).toContain('  "metadata": {');
      expect(fileContent).toContain('    "chain_id": 42161');
      expect(fileContent).toContain('  "blocks": {');
      expect(fileContent).toContain('    "2024-01-15": 12345678');
    });

    it('should maintain date ordering in blocks object', async () => {
      const testData: BlockNumberData = {
        metadata: {
          chain_id: 42161
        },
        blocks: {
          '2024-01-20': 12000000,
          '2024-01-15': 12345678,
          '2024-01-18': 12378901,
          '2024-01-16': 12356789,
          '2024-01-19': 12389012,
          '2024-01-17': 12367890
        }
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();
      
      const dates = Object.keys(result.blocks);
      expect(dates).toEqual([
        '2024-01-20',
        '2024-01-15',
        '2024-01-18',
        '2024-01-16',
        '2024-01-19',
        '2024-01-17'
      ]);
    });

    it('should handle single date entry correctly', async () => {
      const testData: BlockNumberData = {
        metadata: {
          chain_id: 42161
        },
        blocks: {
          '2024-01-15': 12345678
        }
      };

      await fileManager.writeBlockNumbers(testData);
      const result = await fileManager.readBlockNumbers();
      
      expect(Object.keys(result.blocks)).toHaveLength(1);
      expect(result.blocks['2024-01-15']).toBe(12345678);
    });
  });
});