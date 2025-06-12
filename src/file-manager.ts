import * as fs from "fs";
import * as path from "path";
import { getAddress } from "ethers";
import {
  FileManager as FileManagerInterface,
  Address,
  DateString,
  BlockNumberData,
  DistributorsData,
  DistributorInfo,
  BalanceData,
  OutflowData,
  STORE_DIR,
  DISTRIBUTORS_DIR,
  CHAIN_IDS,
  CONTRACTS,
  isValidDistributorType,
} from "./types";

// Error messages
const ERROR_NOT_IMPLEMENTED = "Not implemented";
const ERROR_INVALID_ADDRESS = "Invalid address";
const ERROR_BAD_CHECKSUM = "bad address checksum";

// Constants
const ADDRESS_PREFIX = "0x";
const ISO_DATE_SEPARATOR = "T";
const BLOCK_NUMBERS_FILE = "block_numbers.json";
const DISTRIBUTORS_FILE = "distributors.json";
const BALANCES_FILE = "balances.json";
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const JSON_INDENT_SIZE = 2;

export class FileManager implements FileManagerInterface {
  constructor() {}

  async readBlockNumbers(): Promise<BlockNumberData> {
    const filePath = path.join(STORE_DIR, BLOCK_NUMBERS_FILE);

    if (!fs.existsSync(filePath)) {
      return this.createEmptyBlockNumberData();
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent) as BlockNumberData;
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    this.validateBlockNumberData(data);

    await this.ensureStoreDirectory();

    const filePath = path.join(STORE_DIR, BLOCK_NUMBERS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(data, null, JSON_INDENT_SIZE));
  }

  async readDistributors(): Promise<DistributorsData> {
    const filePath = path.join(STORE_DIR, DISTRIBUTORS_FILE);

    if (!fs.existsSync(filePath)) {
      return this.createEmptyDistributorsData();
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent) as DistributorsData;
  }

  async writeDistributors(data: DistributorsData): Promise<void> {
    this.validateDistributorsData(data);

    await this.ensureStoreDirectory();

    const filePath = path.join(STORE_DIR, DISTRIBUTORS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(data, null, JSON_INDENT_SIZE));
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    const validatedAddress = this.validateAddress(address);
    const filePath = path.join(
      STORE_DIR,
      DISTRIBUTORS_DIR,
      validatedAddress,
      BALANCES_FILE,
    );

    if (!fs.existsSync(filePath)) {
      return this.createEmptyBalanceData(validatedAddress);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent) as BalanceData;
  }

  async writeDistributorBalances(
    address: Address,
    data: BalanceData,
  ): Promise<void> {
    const validatedAddress = this.validateAddress(address);

    await this.ensureDistributorDirectory(validatedAddress);

    const filePath = path.join(
      STORE_DIR,
      DISTRIBUTORS_DIR,
      validatedAddress,
      BALANCES_FILE,
    );

    fs.writeFileSync(filePath, JSON.stringify(data, null, JSON_INDENT_SIZE));
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    void address;
    throw new Error(ERROR_NOT_IMPLEMENTED);
  }

  async writeDistributorOutflows(
    address: Address,
    data: OutflowData,
  ): Promise<void> {
    void address;
    void data;
    throw new Error(ERROR_NOT_IMPLEMENTED);
  }

  async ensureStoreDirectory(): Promise<void> {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  }

  validateAddress(address: string): Address {
    if (!address.startsWith(ADDRESS_PREFIX)) {
      throw new Error(ERROR_INVALID_ADDRESS);
    }

    try {
      return getAddress(address);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes(ERROR_BAD_CHECKSUM)
      ) {
        throw new Error(ERROR_BAD_CHECKSUM);
      }
      throw new Error(ERROR_INVALID_ADDRESS);
    }
  }

  formatDate(date: Date): DateString {
    return date.toISOString().split(ISO_DATE_SEPARATOR)[0] as DateString;
  }

  private createEmptyBlockNumberData(): BlockNumberData {
    return {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
      },
      blocks: {},
    };
  }

  private createEmptyDistributorsData(): DistributorsData {
    return {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        arbowner_address: CONTRACTS.ARB_OWNER,
      },
      distributors: {},
    };
  }

  private createEmptyBalanceData(address: Address): BalanceData {
    return {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: address,
      },
      balances: {},
    };
  }

  private async ensureDistributorDirectory(address: Address): Promise<void> {
    const dirPath = path.join(STORE_DIR, DISTRIBUTORS_DIR, address);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private validateBlockNumberData(data: BlockNumberData): void {
    for (const [date, blockNumber] of Object.entries(data.blocks)) {
      this.validateDateFormat(date);
      this.validateBlockNumber(blockNumber);
    }
  }

  private validateDateFormat(date: string): void {
    if (!DATE_FORMAT_REGEX.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }
  }

  private validateBlockNumber(blockNumber: number): void {
    if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
      throw new Error(
        `Block number must be a positive integer, got: ${blockNumber}`,
      );
    }
  }

  private validateDistributorsData(data: DistributorsData): void {
    for (const [address, distributorInfo] of Object.entries(
      data.distributors,
    )) {
      // Validate checksummed address
      if (address !== this.validateAddress(address)) {
        throw new Error(`Distributor address must be checksummed: ${address}`);
      }

      this.validateDistributorInfo(address, distributorInfo);
    }
  }

  private validateDistributorInfo(
    address: string,
    info: DistributorInfo,
  ): void {
    // Check required fields
    const requiredFields: (keyof DistributorInfo)[] = [
      "type",
      "discovered_block",
      "discovered_date",
      "tx_hash",
      "method",
      "owner",
      "event_data",
    ];

    for (const field of requiredFields) {
      if (info[field] === undefined || info[field] === null) {
        throw new Error(
          `Missing required field '${field}' for distributor ${address}`,
        );
      }
    }

    // Validate distributor type
    if (!isValidDistributorType(info.type)) {
      throw new Error(
        `Invalid distributor type '${info.type}' for distributor ${address}`,
      );
    }

    // Validate date format
    this.validateDateFormat(info.discovered_date);

    // Validate transaction hash
    if (!TX_HASH_REGEX.test(info.tx_hash)) {
      throw new Error(
        `Invalid transaction hash '${info.tx_hash}' for distributor ${address}`,
      );
    }

    // Validate block number
    this.validateBlockNumber(info.discovered_block);

    // Validate owner address
    this.validateAddress(info.owner);
  }
}
