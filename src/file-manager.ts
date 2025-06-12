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
} from "./types";

// Error messages
const ERROR_NOT_IMPLEMENTED = "Not implemented";
const ERROR_INVALID_ADDRESS = "Invalid address";
const ERROR_BAD_CHECKSUM = "bad address checksum";

// Constants
const ADDRESS_PREFIX = "0x";
const ISO_DATE_SEPARATOR = "T";
const BLOCK_NUMBERS_FILE = "block_numbers.json";

export class FileManager implements FileManagerInterface {
  constructor() {}

  async readBlockNumbers(): Promise<BlockNumberData> {
    const filePath = path.join(STORE_DIR, BLOCK_NUMBERS_FILE);

    if (!fs.existsSync(filePath)) {
      return {
        metadata: {
          chain_id: CHAIN_IDS.ARBITRUM_ONE,
        },
        blocks: {},
      };
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent) as BlockNumberData;
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    // Validate dates and block numbers
    for (const [date, blockNumber] of Object.entries(data.blocks)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
      }

      if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
        throw new Error(
          `Block number must be a positive integer, got: ${blockNumber}`,
        );
      }
    }

    // Ensure store directory exists
    await this.ensureStoreDirectory();

    // Write file with 2-space indentation
    const filePath = path.join(STORE_DIR, BLOCK_NUMBERS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async readDistributors(): Promise<DistributorsData> {
    throw new Error(ERROR_NOT_IMPLEMENTED);
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
}
