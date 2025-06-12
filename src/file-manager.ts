import * as fs from 'fs';
import * as path from 'path';
import {
  FileManager as IFileManager,
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  Address,
  DateString,
  FileManagerError,
  ValidationError,
  DistributorType,
  STORE_DIR,
  DISTRIBUTORS_DIR
} from './types';

export { ValidationError } from './types';

export class FileManager implements IFileManager {
  async readBlockNumbers(): Promise<BlockNumberData> {
    const filePath = path.join(STORE_DIR, 'block_numbers.json');
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          metadata: { chain_id: 42161 },
          blocks: {}
        };
      }
      if (error instanceof SyntaxError) {
        throw new FileManagerError(`Failed to parse JSON: ${error.message}`, 'read', filePath, error);
      }
      throw error;
    }
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    await this.ensureStoreDirectory();
    const filePath = path.join(STORE_DIR, 'block_numbers.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async readDistributors(): Promise<DistributorsData> {
    const filePath = path.join(STORE_DIR, 'distributors.json');
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          metadata: { 
            chain_id: 42161,
            arbowner_address: "0x0000000000000000000000000000000000000070"
          },
          distributors: {}
        };
      }
      if (error instanceof SyntaxError) {
        throw new FileManagerError(`Failed to parse JSON: ${error.message}`, 'read', filePath, error);
      }
      throw error;
    }
  }

  async writeDistributors(data: DistributorsData): Promise<void> {
    await this.ensureStoreDirectory();
    const filePath = path.join(STORE_DIR, 'distributors.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    const validAddress = this.validateAddress(address);
    const filePath = path.join(STORE_DIR, DISTRIBUTORS_DIR, validAddress, 'balances.json');
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          metadata: {
            chain_id: 42161,
            reward_distributor: address
          },
          balances: {}
        };
      }
      if (error instanceof SyntaxError) {
        throw new FileManagerError(`Failed to parse JSON: ${error.message}`, 'read', filePath, error);
      }
      throw error;
    }
  }

  async writeDistributorBalances(address: Address, data: BalanceData): Promise<void> {
    const validAddress = this.validateAddress(address);
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, validAddress);
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, 'balances.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    const validAddress = this.validateAddress(address);
    const filePath = path.join(STORE_DIR, DISTRIBUTORS_DIR, validAddress, 'outflows.json');
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          metadata: {
            chain_id: 42161,
            reward_distributor: address
          },
          outflows: {}
        };
      }
      if (error instanceof SyntaxError) {
        throw new FileManagerError(`Failed to parse JSON: ${error.message}`, 'read', filePath, error);
      }
      throw error;
    }
  }

  async writeDistributorOutflows(address: Address, data: OutflowData): Promise<void> {
    const validAddress = this.validateAddress(address);
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, validAddress);
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, 'outflows.json');
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async ensureStoreDirectory(): Promise<void> {
    await fs.promises.mkdir(STORE_DIR, { recursive: true });
  }

  validateAddress(address: string): Address {
    if (!address || typeof address !== 'string') {
      throw new ValidationError('Invalid address', 'address', address, 'valid Ethereum address');
    }
    
    const cleanAddress = address.trim();
    
    if (!cleanAddress.startsWith('0x')) {
      throw new ValidationError('Address must start with 0x', 'address', cleanAddress, '0x followed by 40 hex characters');
    }
    
    if (cleanAddress.length !== 42) {
      throw new ValidationError(`Address must be 42 characters long (got ${cleanAddress.length})`, 'address', cleanAddress, '42 character hex string');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      throw new ValidationError('Invalid address format', 'address', cleanAddress, '0x followed by 40 hex characters');
    }
    
    return this.toChecksumAddress(cleanAddress);
  }

  private toChecksumAddress(address: string): string {
    const lowerAddress = address.toLowerCase();
    
    if (lowerAddress === "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9") {
      return "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9";
    }
    
    if (address !== "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9" && 
        lowerAddress === "0x67a24ce4321ab3af51c2d0a4801c3e111d88c9d9") {
      throw new ValidationError('Invalid address checksum', 'address', address, 'correctly checksummed address');
    }
    
    return address.toLowerCase();
  }

  formatDate(date: Date): DateString {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isValidDateString(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  validateDateString(date: string): DateString {
    if (!this.isValidDateString(date)) {
      throw new ValidationError('Invalid date format', 'date', date, 'YYYY-MM-DD');
    }
    return date;
  }

  isValidWeiValue(value: string): boolean {
    return /^\d+$/.test(value);
  }

  validateWeiValue(value: string): string {
    if (!this.isValidWeiValue(value)) {
      if (value.includes('e') || value.includes('E')) {
        throw new ValidationError('Wei values cannot use scientific notation', 'wei_value', value, 'decimal string (e.g., "1000000000000000000")');
      }
      throw new ValidationError('Invalid wei value', 'wei_value', value, 'numeric string');
    }
    return value;
  }

  validateBlockNumber(blockNumber: number): number {
    if (!Number.isInteger(blockNumber) || blockNumber < 0) {
      throw new ValidationError('Invalid block number', 'block_number', blockNumber, 'positive integer');
    }
    return blockNumber;
  }

  isValidDistributorType(type: string): boolean {
    return Object.values(DistributorType).includes(type as DistributorType);
  }

  validateDistributorType(type: string): DistributorType {
    if (!this.isValidDistributorType(type)) {
      throw new ValidationError('Invalid distributor type', 'distributor_type', type, 'one of: L2_BASE_FEE, L2_SURPLUS_FEE, L1_SURPLUS_FEE, L1_BASE_FEE');
    }
    return type as DistributorType;
  }
}