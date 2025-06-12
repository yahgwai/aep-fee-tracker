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
  DistributorType,
  BalanceData,
  OutflowData,
  STORE_DIR,
  DISTRIBUTORS_DIR,
  CHAIN_IDS,
  CONTRACTS,
} from "./types";

// Error messages
const ERROR_INVALID_ADDRESS = "Invalid address";
const ERROR_BAD_CHECKSUM = "bad address checksum";

// Constants
const ADDRESS_PREFIX = "0x";
const ISO_DATE_SEPARATOR = "T";
const BLOCK_NUMBERS_FILE = "block_numbers.json";
const DISTRIBUTORS_FILE = "distributors.json";
const BALANCES_FILE = "balances.json";
const OUTFLOWS_FILE = "outflows.json";
const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const TX_HASH_LENGTH = 64;
const JSON_INDENT_SIZE = 2;
const MAX_REASONABLE_BLOCK = 1000000000; // 1 billion blocks - Arbitrum mainnet started at block ~0 in 2021

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
    this.validateBalanceData(validatedAddress, data);

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
    const validatedAddress = this.validateAddress(address);
    const filePath = path.join(
      STORE_DIR,
      DISTRIBUTORS_DIR,
      validatedAddress,
      OUTFLOWS_FILE,
    );

    if (!fs.existsSync(filePath)) {
      return this.createEmptyOutflowData(validatedAddress);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent) as OutflowData;
  }

  async writeDistributorOutflows(
    address: Address,
    data: OutflowData,
  ): Promise<void> {
    const validatedAddress = this.validateAddress(address);
    this.validateOutflowData(validatedAddress, data);

    await this.ensureDistributorDirectory(validatedAddress);

    const filePath = path.join(
      STORE_DIR,
      DISTRIBUTORS_DIR,
      validatedAddress,
      OUTFLOWS_FILE,
    );

    fs.writeFileSync(filePath, JSON.stringify(data, null, JSON_INDENT_SIZE));
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
    return date.toISOString().split(ISO_DATE_SEPARATOR)[0]!;
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

  private createEmptyOutflowData(address: Address): OutflowData {
    return {
      metadata: {
        chain_id: CHAIN_IDS.ARBITRUM_ONE,
        reward_distributor: address,
      },
      outflows: {},
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

  validateDateFormat(date: string): void {
    if (!DATE_FORMAT_REGEX.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    // Validate actual calendar date
    const parts = date.split("-");
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    const dateObj = new Date(year, month - 1, day);

    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      throw new Error(`Invalid calendar date: ${date}`);
    }
  }

  validateBlockNumber(blockNumber: number): void {
    if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
      throw new Error(
        `Block number must be a positive integer, got: ${blockNumber}`,
      );
    }

    // Check reasonable range
    if (blockNumber > MAX_REASONABLE_BLOCK) {
      throw new Error(
        `Block number exceeds reasonable maximum: ${blockNumber} (max: ${MAX_REASONABLE_BLOCK})`,
      );
    }
  }

  validateWeiValue(value: string, field?: string, date?: string): void {
    // Check if it's a string
    if (typeof value !== "string") {
      if (field) {
        throw new Error(
          `Invalid wei value\n` +
            `  Field: ${field}\n` +
            (date ? `  Date: ${date}\n` : "") +
            `  Value: ${value}\n` +
            `  Expected: String value\n`,
        );
      }
      throw new Error(
        `Invalid wei value. Value: ${value}. Expected: String value`,
      );
    }

    // Check for scientific notation
    if (value.includes("e") || value.includes("E")) {
      if (field) {
        throw new Error(
          `Invalid numeric format\n` +
            `  Field: ${field}\n` +
            (date ? `  Date: ${date}\n` : "") +
            `  Value: ${value}\n` +
            `  Expected: Decimal string (e.g., "1230000000000000000000")\n`,
        );
      }
      throw new Error(
        `Invalid numeric format. Value: ${value}. Expected: Decimal string (e.g., "1230000000000000000000")`,
      );
    }

    // Check for decimal point
    if (value.includes(".")) {
      if (field) {
        throw new Error(
          `Invalid wei value\n` +
            `  Field: ${field}\n` +
            (date ? `  Date: ${date}\n` : "") +
            `  Value: ${value}\n` +
            `  Expected: Integer string (no decimal points)\n`,
        );
      }
      throw new Error(
        `Invalid wei value. Value: ${value}. Expected: Integer string (no decimal points)`,
      );
    }

    // Check if it's a valid decimal string (only digits)
    if (!/^\d+$/.test(value)) {
      // Check for negative values
      if (value.startsWith("-")) {
        if (field) {
          throw new Error(
            `Invalid wei value\n` +
              `  Field: ${field}\n` +
              (date ? `  Date: ${date}\n` : "") +
              `  Value: ${value}\n` +
              `  Expected: Non-negative decimal string\n`,
          );
        }
        throw new Error(
          `Invalid wei value. Value: ${value}. Expected: Non-negative decimal string`,
        );
      }
      if (field) {
        throw new Error(
          `Invalid wei value\n` +
            `  Field: ${field}\n` +
            (date ? `  Date: ${date}\n` : "") +
            `  Value: ${value}\n` +
            `  Expected: Decimal string containing only digits\n`,
        );
      }
      throw new Error(
        `Invalid wei value. Value: ${value}. Expected: Decimal string containing only digits`,
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
    this.validateEnumValue(
      info.type,
      "DistributorType",
      Object.values(DistributorType),
    );

    // Validate date format
    this.validateDateFormat(info.discovered_date);

    // Validate transaction hash
    this.validateTransactionHash(info.tx_hash);

    // Validate block number
    this.validateBlockNumber(info.discovered_block);

    // Validate owner address
    this.validateAddress(info.owner);
  }

  private validateBalanceData(address: Address, data: BalanceData): void {
    // Validate metadata
    if (data.metadata.reward_distributor !== address) {
      throw new Error(
        `Reward distributor address mismatch: expected ${address}, got ${data.metadata.reward_distributor}`,
      );
    }

    // Validate balances
    for (const [date, balance] of Object.entries(data.balances)) {
      this.validateDateFormat(date);
      this.validateBlockNumber(balance.block_number);
      this.validateWeiValueForBalance(balance.balance_wei, date);
    }
  }

  private validateWeiValueForBalance(value: string, date: string): void {
    this.validateWeiValue(value, "balance_wei", date);
  }

  private validateOutflowData(address: Address, data: OutflowData): void {
    // Validate metadata
    if (data.metadata.reward_distributor !== address) {
      throw new Error(
        `Reward distributor address mismatch: expected ${address}, got ${data.metadata.reward_distributor}`,
      );
    }

    // Validate outflows
    for (const [date, outflow] of Object.entries(data.outflows)) {
      this.validateDateFormat(date);
      this.validateBlockNumber(outflow.block_number);
      this.validateWeiValue(
        outflow.total_outflow_wei,
        "total_outflow_wei",
        date,
      );

      // Validate events
      let totalEventWei = BigInt(0);
      for (const event of outflow.events) {
        // Validate recipient address is checksummed
        if (event.recipient !== this.validateAddress(event.recipient)) {
          throw new Error(
            `Recipient address must be checksummed: ${event.recipient}`,
          );
        }

        // Validate event value
        this.validateWeiValue(event.value_wei, "event.value_wei", date);

        // Validate transaction hash
        this.validateTransactionHash(event.tx_hash);

        // Add to total
        totalEventWei += BigInt(event.value_wei);
      }

      // Validate that total matches sum of events
      if (totalEventWei.toString() !== outflow.total_outflow_wei) {
        throw new Error(
          `Total outflow mismatch for ${date}: expected ${totalEventWei.toString()}, got ${outflow.total_outflow_wei}`,
        );
      }
    }
  }

  validateTransactionHash(txHash: string): void {
    if (!TX_HASH_REGEX.test(txHash)) {
      throw new Error(
        `Invalid transaction hash format: ${txHash}. Expected 0x followed by ${TX_HASH_LENGTH} hexadecimal characters`,
      );
    }
  }

  validateEnumValue(
    value: string,
    enumName: string,
    validValues: string[],
  ): void {
    if (!validValues.includes(value)) {
      throw new Error(
        `Invalid ${enumName} value: ${value}. Valid values are: ${validValues.join(", ")}`,
      );
    }
  }
}
