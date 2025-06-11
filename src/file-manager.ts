import * as fs from 'fs';
import * as path from 'path';
import { getAddress } from 'ethers';
import {
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  CHAIN_IDS,
  CONTRACTS,
  STORE_DIR,
  DISTRIBUTORS_DIR,
  FileManagerError,
  ValidationError,
  isValidDistributorType,
  isValidDateString,
  isValidDecimalString,
  Address,
  DateString
} from './types';

export class FileManager {
  private readJsonFile<T>(filePath: string, defaultValue: T): T {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  private writeJsonFile(filePath: string, data: any): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async readBlockNumbers(): Promise<BlockNumberData> {
    const filePath = path.join(STORE_DIR, 'block_numbers.json');
    
    try {
      return this.readJsonFile(filePath, {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE
        },
        blocks: {}
      });
    } catch (error: any) {
      throw new FileManagerError(
        `Failed to read block numbers: ${error.message}`,
        'readBlockNumbers',
        filePath,
        error
      );
    }
  }

  private validateDate(date: string, fieldName: string): void {
    if (!isValidDateString(date)) {
      throw new ValidationError(
        `Invalid date format`,
        fieldName,
        date,
        'YYYY-MM-DD format'
      );
    }
    
    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== date) {
      throw new ValidationError(
        `Invalid date`,
        fieldName,
        date,
        'Valid calendar date in YYYY-MM-DD format'
      );
    }
  }

  private validateBlockNumber(blockNumber: any, fieldName: string): void {
    if (typeof blockNumber !== 'number') {
      throw new ValidationError(
        `Block number must be a number`,
        fieldName,
        blockNumber,
        'number'
      );
    }
    
    if (blockNumber <= 0) {
      throw new ValidationError(
        `Block number must be positive`,
        fieldName,
        blockNumber,
        'positive integer'
      );
    }
    
    if (!Number.isInteger(blockNumber)) {
      throw new ValidationError(
        `Block number must be an integer`,
        fieldName,
        blockNumber,
        'integer'
      );
    }
  }

  private validateWeiValue(value: any, fieldName: string): void {
    if (typeof value !== 'string') {
      throw new ValidationError(
        `${fieldName} must be a string`,
        fieldName,
        value,
        'decimal string'
      );
    }
    
    if (!isValidDecimalString(value)) {
      throw new ValidationError(
        `Invalid numeric format in ${fieldName}`,
        fieldName,
        value,
        'Decimal string (e.g., "1230000000000000000000")'
      );
    }
    
    if (value.startsWith('-')) {
      throw new ValidationError(
        `${fieldName} cannot be negative`,
        fieldName,
        value,
        'Non-negative decimal string'
      );
    }
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    const filePath = path.join(STORE_DIR, 'block_numbers.json');
    
    for (const [date, blockNumber] of Object.entries(data.blocks)) {
      this.validateDate(date, 'date');
      this.validateBlockNumber(blockNumber, 'block_number');
    }
    
    await this.ensureStoreDirectory();
    this.writeJsonFile(filePath, data);
  }

  async readDistributors(): Promise<DistributorsData> {
    const filePath = path.join(STORE_DIR, 'distributors.json');
    
    try {
      return this.readJsonFile(filePath, {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          arbowner_address: CONTRACTS.ARB_OWNER
        },
        distributors: {}
      });
    } catch (error: any) {
      throw new FileManagerError(
        `Failed to read distributors: ${error.message}`,
        'readDistributors',
        filePath,
        error
      );
    }
  }

  async writeDistributors(data: DistributorsData): Promise<void> {
    const filePath = path.join(STORE_DIR, 'distributors.json');
    
    for (const [address, info] of Object.entries(data.distributors)) {
      this.validateAddress(address);
      
      if (!isValidDistributorType(info.type)) {
        throw new ValidationError(
          `Invalid distributor type. Valid types are: L2_BASE_FEE, L2_SURPLUS_FEE, L1_SURPLUS_FEE, L1_BASE_FEE`,
          'type',
          info.type,
          'valid DistributorType enum value'
        );
      }
      
      this.validateDate(info.discovered_date, 'discovered_date');
    }
    
    await this.ensureStoreDirectory();
    this.writeJsonFile(filePath, data);
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    const checksummedAddress = this.validateAddress(address);
    const filePath = path.join(STORE_DIR, DISTRIBUTORS_DIR, checksummedAddress, 'balances.json');
    
    try {
      return this.readJsonFile(filePath, {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: checksummedAddress
        },
        balances: {}
      });
    } catch (error: any) {
      throw new FileManagerError(
        `Failed to read balances: ${error.message}`,
        'readDistributorBalances',
        filePath,
        error
      );
    }
  }

  async writeDistributorBalances(address: Address, data: BalanceData): Promise<void> {
    const checksummedAddress = this.validateAddress(address);
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, checksummedAddress);
    const filePath = path.join(dirPath, 'balances.json');
    
    for (const [date, balance] of Object.entries(data.balances)) {
      this.validateDate(date, 'date');
      this.validateWeiValue(balance.balance_wei, 'balance_wei');
    }
    
    await this.ensureDistributorDirectory(checksummedAddress);
    this.writeJsonFile(filePath, data);
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    const checksummedAddress = this.validateAddress(address);
    const filePath = path.join(STORE_DIR, DISTRIBUTORS_DIR, checksummedAddress, 'outflows.json');
    
    try {
      return this.readJsonFile(filePath, {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
          reward_distributor: checksummedAddress
        },
        outflows: {}
      });
    } catch (error: any) {
      throw new FileManagerError(
        `Failed to read outflows: ${error.message}`,
        'readDistributorOutflows',
        filePath,
        error
      );
    }
  }

  async writeDistributorOutflows(address: Address, data: OutflowData): Promise<void> {
    const checksummedAddress = this.validateAddress(address);
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, checksummedAddress);
    const filePath = path.join(dirPath, 'outflows.json');
    
    for (const [date, outflow] of Object.entries(data.outflows)) {
      this.validateDate(date, 'date');
      this.validateWeiValue(outflow.total_outflow_wei, 'total_outflow_wei');
      
      for (const event of outflow.events) {
        this.validateWeiValue(event.value_wei, 'value_wei');
      }
    }
    
    await this.ensureDistributorDirectory(checksummedAddress);
    this.writeJsonFile(filePath, data);
  }

  async ensureStoreDirectory(): Promise<void> {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  }

  async ensureDistributorDirectory(address: Address): Promise<void> {
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, address);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  validateAddress(address: string): Address {
    if (!address || typeof address !== 'string') {
      throw new ValidationError(
        `Invalid address`,
        'address',
        address,
        'valid Ethereum address'
      );
    }
    
    if (!address.startsWith('0x')) {
      throw new ValidationError(
        `Address must start with 0x`,
        'address',
        address,
        'address starting with 0x'
      );
    }
    
    if (address.length !== 42) {
      throw new ValidationError(
        `Invalid address length`,
        'address',
        address,
        '42 character address'
      );
    }
    
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new ValidationError(
        `Invalid address format`,
        'address',
        address,
        'valid hexadecimal address'
      );
    }
    
    try {
      return getAddress(address);
    } catch (error) {
      throw new ValidationError(
        `Invalid address checksum`,
        'address',
        address,
        'properly checksummed address'
      );
    }
  }

  formatDate(date: Date): DateString {
    return date.toISOString().split('T')[0];
  }
}