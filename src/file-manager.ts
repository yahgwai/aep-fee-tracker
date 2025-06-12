import * as fs from "fs";
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
} from "./types";

// Error messages
const ERROR_NOT_IMPLEMENTED = "Not implemented";
const ERROR_INVALID_ADDRESS = "Invalid address";
const ERROR_BAD_CHECKSUM = "bad address checksum";

// Constants
const ADDRESS_PREFIX = "0x";
const ISO_DATE_SEPARATOR = "T";

export class FileManager implements FileManagerInterface {
  constructor() {}

  async readBlockNumbers(): Promise<BlockNumberData> {
    throw new Error(ERROR_NOT_IMPLEMENTED);
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    void data;
    throw new Error(ERROR_NOT_IMPLEMENTED);
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
