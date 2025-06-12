import * as fs from "fs";
import * as path from "path";
import { getAddress } from "ethers";
import {
  FileManager as FileManagerInterface,
  Address,
  DateString,
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  STORE_DIR,
  CHAIN_IDS,
  CONTRACTS,
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
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
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
    void data;
    throw new Error(ERROR_NOT_IMPLEMENTED);
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    void address;
    throw new Error(ERROR_NOT_IMPLEMENTED);
  }

  async writeDistributorBalances(
    address: Address,
    data: BalanceData,
  ): Promise<void> {
    void address;
    void data;
    throw new Error(ERROR_NOT_IMPLEMENTED);
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
}
