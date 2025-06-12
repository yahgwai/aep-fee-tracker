import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../../src/file-manager';
import { BlockNumberData, DistributorsData, BalanceData, OutflowData, DistributorType, FileManagerError, ValidationError } from '../../src/types';
import { randomBytes } from 'crypto';

describe('FileManager - Operations Tests', () => {
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

  describe('Directory Creation', () => {
    it('should create store directory if it does not exist', async () => {
      expect(fs.existsSync('store')).toBe(false);
      
      await fileManager.ensureStoreDirectory();
      
      expect(fs.existsSync('store')).toBe(true);
      expect(fs.statSync('store').isDirectory()).toBe(true);
    });

    it('should create nested distributor directory on first write', async () => {
      const address = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const dirPath = path.join('store', 'distributors', address.toLowerCase());
      
      expect(fs.existsSync(dirPath)).toBe(false);

      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: address
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributorBalances(address, testData);
      
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it('should handle concurrent directory creation gracefully', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(fileManager.ensureStoreDirectory());
      }
      
      await Promise.all(promises);
      
      expect(fs.existsSync('store')).toBe(true);
    });

    it('should not error if directory already exists', async () => {
      await fileManager.ensureStoreDirectory();
      expect(fs.existsSync('store')).toBe(true);
      
      await expect(fileManager.ensureStoreDirectory()).resolves.not.toThrow();
    });

    it('should create directories with 0755 permissions', async () => {
      await fileManager.ensureStoreDirectory();
      
      const stats = fs.statSync('store');
      const mode = (stats.mode & parseInt('777', 8)).toString(8);
      
      expect(mode).toBe('755');
    });

    it('should create files with 0644 permissions', async () => {
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
      const stats = fs.statSync(filePath);
      const mode = (stats.mode & parseInt('777', 8)).toString(8);
      
      expect(mode).toBe('644');
    });
  });

  describe('Error Messages', () => {
    it('should include file path in file system errors', async () => {
      const storeDir = path.join(tempDir, 'store');
      fs.mkdirSync(storeDir);
      const filePath = path.join(storeDir, 'block_numbers.json');
      fs.writeFileSync(filePath, '{}', { mode: 0o000 });

      try {
        await fileManager.readBlockNumbers();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
        const err = error as FileManagerError;
        expect(err.message).toContain(filePath);
        expect(err.path).toBe(filePath);
      }
    });

    it('should include field name and value in validation errors', async () => {
      try {
        fileManager.validateAddress("invalid-address");
        fail('Should have thrown an error');
      } catch (error) {
        const err = error as ValidationError;
        expect(err.field).toBe('address');
        expect(err.value).toBe('invalid-address');
        expect(err.message).toContain('address');
        expect(err.message).toContain('invalid-address');
      }
    });

    it('should suggest fixes for common errors', async () => {
      try {
        fileManager.validateWeiValue("1.23e+21");
        fail('Should have thrown an error');
      } catch (error) {
        const err = error as ValidationError;
        expect(err.message).toContain('scientific notation');
        expect(err.expected).toContain('decimal string');
      }
    });

    it('should differentiate between corruption and missing files', async () => {
      const result = await fileManager.readBlockNumbers();
      expect(result).toEqual({
        metadata: { chain_id: 42161 },
        blocks: {}
      });

      fs.mkdirSync('store', { recursive: true });
      fs.writeFileSync(path.join('store', 'block_numbers.json'), '{invalid json');

      try {
        await fileManager.readBlockNumbers();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
        const err = error as FileManagerError;
        expect(err.message).toContain('parse');
        expect(err.operation).toBe('read');
      }
    });

    it('should include line and column for JSON parse errors', async () => {
      fs.mkdirSync('store', { recursive: true });
      fs.writeFileSync(path.join('store', 'block_numbers.json'), '{\n  "metadata": {\n    "chain_id": 42161,\n  }\n}');

      try {
        await fileManager.readBlockNumbers();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
        const err = error as FileManagerError;
        expect(err.message).toMatch(/line|position|column/i);
      }
    });

    it('should show expected format for validation failures', async () => {
      try {
        fileManager.validateDateString("01/15/2024");
        fail('Should have thrown an error');
      } catch (error) {
        const err = error as ValidationError;
        expect(err.expected).toBe('YYYY-MM-DD');
        expect(err.message).toContain('YYYY-MM-DD');
      }
    });
  });

  describe('Atomic Write Operations', () => {
    it('should not leave partial files on write failure', async () => {
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Disk full');
      });

      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      try {
        await fileManager.writeBlockNumbers(testData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
      }

      const filePath = path.join('store', 'block_numbers.json');
      expect(fs.existsSync(filePath)).toBe(false);

      mockWriteFileSync.mockRestore();
    });

    it('should not corrupt existing file if update fails', async () => {
      const originalData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      await fileManager.writeBlockNumbers(originalData);
      const originalContent = fs.readFileSync(path.join('store', 'block_numbers.json'), 'utf-8');

      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      const updatedData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-16': 23456789 }
      };

      try {
        await fileManager.writeBlockNumbers(updatedData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
      }

      const currentContent = fs.readFileSync(path.join('store', 'block_numbers.json'), 'utf-8');
      expect(currentContent).toBe(originalContent);

      mockWriteFileSync.mockRestore();
    });

    it('should write complete file in single operation', async () => {
      const writeFileSync = jest.spyOn(fs, 'writeFileSync');

      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      await fileManager.writeBlockNumbers(testData);

      expect(writeFileSync).toHaveBeenCalledTimes(1);
      writeFileSync.mockRestore();
    });

    it('should handle disk full errors gracefully', async () => {
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        const error: any = new Error('ENOSPC: no space left on device');
        error.code = 'ENOSPC';
        throw error;
      });

      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      try {
        await fileManager.writeBlockNumbers(testData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
        const err = error as FileManagerError;
        expect(err.message).toContain('no space left');
        expect(err.message).toContain('Free disk space');
      }

      mockWriteFileSync.mockRestore();
    });

    it('should handle permission denied errors clearly', async () => {
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        const error: any = new Error('EACCES: permission denied');
        error.code = 'EACCES';
        throw error;
      });

      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      try {
        await fileManager.writeBlockNumbers(testData);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileManagerError);
        const err = error as FileManagerError;
        expect(err.message).toContain('permission denied');
        expect(err.message).toContain('Check file permissions');
      }

      mockWriteFileSync.mockRestore();
    });
  });

  describe('JSON Formatting', () => {
    it('should write JSON with 2-space indentation', async () => {
      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { '2024-01-15': 12345678 }
      };

      await fileManager.writeBlockNumbers(testData);
      
      const content = fs.readFileSync(path.join('store', 'block_numbers.json'), 'utf-8');
      expect(content).toContain('  "metadata"');
      expect(content).toContain('    "chain_id"');
    });

    it('should write each object property on new line', async () => {
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
          }
        }
      };

      await fileManager.writeDistributors(testData);
      
      const content = fs.readFileSync(path.join('store', 'distributors.json'), 'utf-8');
      const lines = content.split('\n');
      
      expect(lines.some(line => line.includes('"type"'))).toBe(true);
      expect(lines.some(line => line.includes('"discovered_block"'))).toBe(true);
      expect(lines.some(line => line.includes('"discovered_date"'))).toBe(true);
    });

    it('should write arrays with proper indentation', async () => {
      const testData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "3000000000000000000000",
            events: [
              {
                recipient: "0xRecipient0000000000000000000000000000001",
                value_wei: "1000000000000000000000",
                tx_hash: "0xabc123"
              },
              {
                recipient: "0xRecipient0000000000000000000000000000002",
                value_wei: "2000000000000000000000",
                tx_hash: "0xdef456"
              }
            ]
          }
        }
      };

      await fileManager.writeDistributorOutflows("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9", testData);
      
      const filePath = path.join('store', 'distributors', '0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9', 'outflows.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('      {\n');
      expect(content).toContain('        "recipient"');
      expect(content).toContain('      },\n      {\n');
    });

    it('should not include trailing commas', async () => {
      const testData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: {
          '2024-01-15': 12345678,
          '2024-01-16': 23456789
        }
      };

      await fileManager.writeBlockNumbers(testData);
      
      const content = fs.readFileSync(path.join('store', 'block_numbers.json'), 'utf-8');
      
      expect(content).not.toMatch(/,\s*}/);
      expect(content).not.toMatch(/,\s*\]/);
    });

    it('should use consistent property ordering', async () => {
      const testData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributorBalances("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9", testData);
      
      const filePath = path.join('store', 'distributors', '0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9', 'balances.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const metadataIndex = content.indexOf('"metadata"');
      const balancesIndex = content.indexOf('"balances"');
      
      expect(metadataIndex).toBeLessThan(balancesIndex);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full lifecycle of new distributor', async () => {
      const distributorAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          [distributorAddress]: {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc123",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          }
        }
      };

      await fileManager.writeDistributors(distributorsData);

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: distributorAddress
        },
        balances: {
          '2024-01-15': {
            block_number: 12345678,
            balance_wei: "1000000000000000000000"
          }
        }
      };

      await fileManager.writeDistributorBalances(distributorAddress, balanceData);

      const outflowData: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: distributorAddress
        },
        outflows: {
          '2024-01-15': {
            block_number: 12345678,
            total_outflow_wei: "500000000000000000000",
            events: [{
              recipient: "0xRecipient0000000000000000000000000000001",
              value_wei: "500000000000000000000",
              tx_hash: "0xdef456"
            }]
          }
        }
      };

      await fileManager.writeDistributorOutflows(distributorAddress, outflowData);

      const readDistributors = await fileManager.readDistributors();
      const readBalance = await fileManager.readDistributorBalances(distributorAddress);
      const readOutflow = await fileManager.readDistributorOutflows(distributorAddress);

      expect(readDistributors.distributors[distributorAddress]).toBeDefined();
      expect(readBalance.balances['2024-01-15'].balance_wei).toBe("1000000000000000000000");
      expect(readOutflow.outflows['2024-01-15'].total_outflow_wei).toBe("500000000000000000000");
    });

    it('should support incremental daily updates', async () => {
      const blockData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: {
          '2024-01-15': 12345678
        }
      };

      await fileManager.writeBlockNumbers(blockData);

      blockData.blocks['2024-01-16'] = 12356789;
      await fileManager.writeBlockNumbers(blockData);

      blockData.blocks['2024-01-17'] = 12367890;
      await fileManager.writeBlockNumbers(blockData);

      const result = await fileManager.readBlockNumbers();
      expect(Object.keys(result.blocks)).toHaveLength(3);
      expect(result.blocks['2024-01-15']).toBe(12345678);
      expect(result.blocks['2024-01-16']).toBe(12356789);
      expect(result.blocks['2024-01-17']).toBe(12367890);
    });

    it('should maintain consistency across all files', async () => {
      const distributorAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const date = "2024-01-15";
      const blockNumber = 12345678;

      const blockData: BlockNumberData = {
        metadata: { chain_id: 42161 },
        blocks: { [date]: blockNumber }
      };
      await fileManager.writeBlockNumbers(blockData);

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          [distributorAddress]: {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: blockNumber,
            discovered_date: date,
            tx_hash: "0xabc123",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          }
        }
      };
      await fileManager.writeDistributors(distributorsData);

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: distributorAddress
        },
        balances: {
          [date]: {
            block_number: blockNumber,
            balance_wei: "1000000000000000000000"
          }
        }
      };
      await fileManager.writeDistributorBalances(distributorAddress, balanceData);

      const readBlocks = await fileManager.readBlockNumbers();
      const readDistributors = await fileManager.readDistributors();
      const readBalance = await fileManager.readDistributorBalances(distributorAddress);

      expect(readBlocks.blocks[date]).toBe(blockNumber);
      expect(readDistributors.distributors[distributorAddress].discovered_block).toBe(blockNumber);
      expect(readBalance.balances[date].block_number).toBe(blockNumber);
    });

    it('should handle 1000+ distributors without performance issues', async () => {
      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {}
      };

      for (let i = 0; i < 1000; i++) {
        const address = `0x${i.toString(16).padStart(40, '0')}`;
        distributorsData.distributors[address] = {
          type: DistributorType.L2_BASE_FEE,
          discovered_block: 10000000 + i,
          discovered_date: "2024-01-15",
          tx_hash: `0x${i.toString(16).padStart(64, '0')}`,
          method: "0xee95a824",
          owner: "0x0000000000000000000000000000000000000070",
          event_data: `0x${address.slice(2).padStart(64, '0')}`
        };
      }

      const startTime = Date.now();
      await fileManager.writeDistributors(distributorsData);
      const writeTime = Date.now() - startTime;

      const readStartTime = Date.now();
      const result = await fileManager.readDistributors();
      const readTime = Date.now() - readStartTime;

      expect(Object.keys(result.distributors)).toHaveLength(1000);
      expect(writeTime).toBeLessThan(1000);
      expect(readTime).toBeLessThan(100);
    });

    it('should work with actual mainnet data examples', async () => {
      const mainnetAddress = "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
      const mainnetTxHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const mainnetBlockNumber = 150000000;
      const mainnetBalanceWei = "123456789012345678901234567890";

      const distributorsData: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070"
        },
        distributors: {
          [mainnetAddress]: {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: mainnetBlockNumber,
            discovered_date: "2024-01-15",
            tx_hash: mainnetTxHash,
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data: "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
          }
        }
      };

      await fileManager.writeDistributors(distributorsData);

      const balanceData: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: mainnetAddress
        },
        balances: {
          '2024-01-15': {
            block_number: mainnetBlockNumber,
            balance_wei: mainnetBalanceWei
          }
        }
      };

      await fileManager.writeDistributorBalances(mainnetAddress, balanceData);

      const readDistributors = await fileManager.readDistributors();
      const readBalance = await fileManager.readDistributorBalances(mainnetAddress);

      expect(readDistributors.distributors[mainnetAddress].discovered_block).toBe(mainnetBlockNumber);
      expect(readBalance.balances['2024-01-15'].balance_wei).toBe(mainnetBalanceWei);
    });
  });
});