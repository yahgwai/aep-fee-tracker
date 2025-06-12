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

// File system constants
const BLOCK_NUMBERS_FILE = "block_numbers.json";
const DISTRIBUTORS_FILE = "distributors.json";
const BALANCES_FILE = "balances.json";
const OUTFLOWS_FILE = "outflows.json";
const JSON_INDENT_SIZE = 2;

// Ethereum constants
const ADDRESS_PREFIX = "0x";
const TX_HASH_LENGTH = 64;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

// Date and time constants
const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Validation constants
const MAX_REASONABLE_BLOCK = 1000000000; // 1 billion blocks - Arbitrum mainnet started at block ~0 in 2021
const EXAMPLE_WEI_VALUE = "1230000000000000000000";
const WEI_DECIMAL_REGEX = /^\d+$/;

export class FileManager implements FileManagerInterface {
  async readBlockNumbers(): Promise<BlockNumberData> {
    return this.readJsonFile(path.join(STORE_DIR, BLOCK_NUMBERS_FILE), () =>
      this.createEmptyBlockNumberData(),
    );
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    this.validateBlockNumberData(data);
    this.ensureStoreDirectory();
    this.writeJsonFile(path.join(STORE_DIR, BLOCK_NUMBERS_FILE), data);
  }

  async readDistributors(): Promise<DistributorsData> {
    return this.readJsonFile(path.join(STORE_DIR, DISTRIBUTORS_FILE), () =>
      this.createEmptyDistributorsData(),
    );
  }

  async writeDistributors(data: DistributorsData): Promise<void> {
    this.validateDistributorsData(data);
    this.ensureStoreDirectory();
    this.writeJsonFile(path.join(STORE_DIR, DISTRIBUTORS_FILE), data);
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    const validatedAddress = this.validateAddress(address);
    return this.readJsonFile(
      this.getDistributorFilePath(validatedAddress, BALANCES_FILE),
      () => this.createEmptyBalanceData(validatedAddress),
    );
  }

  async writeDistributorBalances(
    address: Address,
    data: BalanceData,
  ): Promise<void> {
    const validatedAddress = this.validateAddress(address);
    this.validateBalanceData(validatedAddress, data);
    this.ensureDistributorDirectory(validatedAddress);
    this.writeJsonFile(
      this.getDistributorFilePath(validatedAddress, BALANCES_FILE),
      data,
    );
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    const validatedAddress = this.validateAddress(address);
    return this.readJsonFile(
      this.getDistributorFilePath(validatedAddress, OUTFLOWS_FILE),
      () => this.createEmptyOutflowData(validatedAddress),
    );
  }

  async writeDistributorOutflows(
    address: Address,
    data: OutflowData,
  ): Promise<void> {
    const validatedAddress = this.validateAddress(address);
    this.validateOutflowData(validatedAddress, data);
    this.ensureDistributorDirectory(validatedAddress);
    this.writeJsonFile(
      this.getDistributorFilePath(validatedAddress, OUTFLOWS_FILE),
      data,
    );
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
    return date.toISOString().split("T")[0]!;
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

  private getDistributorFilePath(address: Address, fileName: string): string {
    return path.join(STORE_DIR, DISTRIBUTORS_DIR, address, fileName);
  }

  private readJsonFile<T>(filePath: string, defaultFactory: () => T): T {
    if (!fs.existsSync(filePath)) {
      return defaultFactory();
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  }

  private writeJsonFile(filePath: string, data: unknown): void {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, JSON_INDENT_SIZE));
    fs.renameSync(tempPath, filePath);
  }

  private validateBlockNumberData(data: BlockNumberData): void {
    for (const [date, blockNumber] of Object.entries(data.blocks)) {
      this.validateDateFormat(date);
      this.validateBlockNumber(blockNumber);
    }
  }

  /**
   * Validates that a date string is in YYYY-MM-DD format and represents a valid calendar date
   * @throws {Error} If the date format is invalid or the date doesn't exist
   */
  validateDateFormat(date: string): void {
    if (!DATE_FORMAT_REGEX.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    // Validate it's an actual calendar date by parsing and checking roundtrip
    const parsed = new Date(date + "T00:00:00Z");
    const roundtrip = parsed.toISOString().split("T")[0];
    if (roundtrip !== date) {
      throw new Error(`Invalid calendar date: ${date}`);
    }
  }

  /**
   * Validates that a block number is a positive integer within reasonable bounds
   * @throws {Error} If the block number is invalid
   */
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

  /**
   * Validates that a value is a valid wei amount (non-negative integer string)
   * @param value The value to validate
   * @param field Optional field name for error context
   * @param date Optional date for error context
   * @throws {Error} If the value is not a valid wei amount
   */
  validateWeiValue(value: string, field?: string, date?: string): void {
    const formatError = (message: string, expected: string) => {
      if (!field) {
        return new Error(`${message}. Value: ${value}. Expected: ${expected}`);
      }
      return new Error(
        `${message}\n` +
          `  Field: ${field}\n` +
          (date ? `  Date: ${date}\n` : "") +
          `  Value: ${value}\n` +
          `  Expected: ${expected}\n`,
      );
    };

    if (typeof value !== "string") {
      throw formatError("Invalid wei value", "String value");
    }

    if (value.includes("e") || value.includes("E")) {
      throw formatError(
        "Invalid numeric format",
        `Decimal string (e.g., "${EXAMPLE_WEI_VALUE}")`,
      );
    }

    if (value.includes(".")) {
      throw formatError(
        "Invalid wei value",
        "Integer string (no decimal points)",
      );
    }

    if (!WEI_DECIMAL_REGEX.test(value)) {
      const expected = value.startsWith("-")
        ? "Non-negative decimal string"
        : "Decimal string containing only digits";
      throw formatError("Invalid wei value", expected);
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

    // Validate field values
    this.validateEnumValue(
      info.type,
      "DistributorType",
      Object.values(DistributorType),
    );
    this.validateDateFormat(info.discovered_date);
    this.validateTransactionHash(info.tx_hash);
    this.validateBlockNumber(info.discovered_block);
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
      this.validateWeiValue(balance.balance_wei, "balance_wei", date);
    }
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

      // Validate events and sum values
      let totalEventWei = BigInt(0);
      for (const event of outflow.events) {
        // Validate recipient address is checksummed
        if (event.recipient !== this.validateAddress(event.recipient)) {
          throw new Error(
            `Recipient address must be checksummed: ${event.recipient}`,
          );
        }

        this.validateWeiValue(event.value_wei, "event.value_wei", date);
        this.validateTransactionHash(event.tx_hash);
        totalEventWei += BigInt(event.value_wei);
      }

      // Validate total matches sum of events
      if (totalEventWei.toString() !== outflow.total_outflow_wei) {
        throw new Error(
          `Total outflow mismatch for ${date}: expected ${totalEventWei.toString()}, got ${outflow.total_outflow_wei}`,
        );
      }
    }
  }

  /**
   * Validates that a transaction hash is in the correct format (0x followed by 64 hex characters)
   * @throws {Error} If the transaction hash format is invalid
   */
  validateTransactionHash(txHash: string): void {
    if (!TX_HASH_REGEX.test(txHash)) {
      throw new Error(
        `Invalid transaction hash format: ${txHash}. Expected 0x followed by ${TX_HASH_LENGTH} hexadecimal characters`,
      );
    }
  }

  /**
   * Validates that a value is one of the allowed enum values
   * @param value The value to validate
   * @param enumName The name of the enum for error messages
   * @param validValues Array of valid values
   * @throws {Error} If the value is not in the list of valid values
   */
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
