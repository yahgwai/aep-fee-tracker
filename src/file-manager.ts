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
  DailyOutflow,
  OutflowEvent,
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
const ISO_DATE_SEPARATOR = "T";
const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_SEPARATOR = "-";
const DATE_PARTS_COUNT = 3;
const MONTH_INDEX_OFFSET = 1; // JavaScript months are 0-indexed

// Validation constants
const MAX_REASONABLE_BLOCK = 1000000000; // 1 billion blocks - Arbitrum mainnet started at block ~0 in 2021
const EXAMPLE_WEI_VALUE = "1230000000000000000000";
const WEI_DECIMAL_REGEX = /^\d+$/;
const NEGATIVE_NUMBER_PREFIX = "-";

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
    this.writeJsonFile(filePath, data);
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
    this.writeJsonFile(filePath, data);
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    const validatedAddress = this.validateAddress(address);
    const filePath = this.getDistributorFilePath(
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

    const filePath = this.getDistributorFilePath(
      validatedAddress,
      BALANCES_FILE,
    );
    this.writeJsonFile(filePath, data);
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    const validatedAddress = this.validateAddress(address);
    const filePath = this.getDistributorFilePath(
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

    const filePath = this.getDistributorFilePath(
      validatedAddress,
      OUTFLOWS_FILE,
    );
    this.writeJsonFile(filePath, data);
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
    const isoString = date.toISOString();
    const datePart = isoString.split(ISO_DATE_SEPARATOR)[0];
    if (!datePart) {
      throw new Error("Failed to format date");
    }
    return datePart;
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
    const dirPath = this.getDistributorDirectoryPath(address);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getDistributorDirectoryPath(address: Address): string {
    return path.join(STORE_DIR, DISTRIBUTORS_DIR, address);
  }

  private getDistributorFilePath(address: Address, fileName: string): string {
    return path.join(this.getDistributorDirectoryPath(address), fileName);
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
    // First check format: YYYY-MM-DD with valid month/day ranges
    if (!DATE_FORMAT_REGEX.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    // Then validate it's an actual calendar date
    const dateParts = date.split(DATE_SEPARATOR);
    if (dateParts.length !== DATE_PARTS_COUNT) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    const year = parseInt(dateParts[0]!, 10);
    const month = parseInt(dateParts[1]!, 10);
    const day = parseInt(dateParts[2]!, 10);
    const dateObj = new Date(year, month - MONTH_INDEX_OFFSET, day);

    // Check if the date components match (catches invalid dates like Feb 30)
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - MONTH_INDEX_OFFSET ||
      dateObj.getDate() !== day
    ) {
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
    if (typeof value !== "string") {
      throw this.createWeiValidationError(
        "Invalid wei value",
        "String value",
        value,
        field,
        date,
      );
    }

    if (this.containsScientificNotation(value)) {
      throw this.createWeiValidationError(
        "Invalid numeric format",
        `Decimal string (e.g., "${EXAMPLE_WEI_VALUE}")`,
        value,
        field,
        date,
      );
    }

    if (this.containsDecimalPoint(value)) {
      throw this.createWeiValidationError(
        "Invalid wei value",
        "Integer string (no decimal points)",
        value,
        field,
        date,
      );
    }

    if (!this.isValidWeiFormat(value)) {
      const errorMessage = this.isNegativeValue(value)
        ? "Non-negative decimal string"
        : "Decimal string containing only digits";
      throw this.createWeiValidationError(
        "Invalid wei value",
        errorMessage,
        value,
        field,
        date,
      );
    }
  }

  private createWeiValidationError(
    message: string,
    expected: string,
    value: unknown,
    field?: string,
    date?: string,
  ): Error {
    if (field) {
      const errorLines = [
        message,
        `  Field: ${field}`,
        date ? `  Date: ${date}` : null,
        `  Value: ${value}`,
        `  Expected: ${expected}`,
      ].filter((line): line is string => line !== null);
      return new Error(errorLines.join("\n") + "\n");
    }
    return new Error(`${message}. Value: ${value}. Expected: ${expected}`);
  }

  private containsScientificNotation(value: string): boolean {
    return value.includes("e") || value.includes("E");
  }

  private containsDecimalPoint(value: string): boolean {
    return value.includes(".");
  }

  private isValidWeiFormat(value: string): boolean {
    return WEI_DECIMAL_REGEX.test(value);
  }

  private isNegativeValue(value: string): boolean {
    return value.startsWith(NEGATIVE_NUMBER_PREFIX);
  }

  private validateDistributorsData(data: DistributorsData): void {
    for (const [address, distributorInfo] of Object.entries(
      data.distributors,
    )) {
      this.validateChecksummedAddress(
        address,
        "Distributor address must be checksummed",
      );
      this.validateDistributorInfo(address, distributorInfo);
    }
  }

  private validateDistributorInfo(
    address: string,
    info: DistributorInfo,
  ): void {
    this.validateRequiredDistributorFields(address, info);
    this.validateDistributorFieldValues(info);
  }

  private validateRequiredDistributorFields(
    address: string,
    info: DistributorInfo,
  ): void {
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
  }

  private validateDistributorFieldValues(info: DistributorInfo): void {
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
    this.validateBalanceMetadata(address, data.metadata);
    this.validateAllBalances(data.balances);
  }

  private validateBalanceMetadata(
    expectedAddress: Address,
    metadata: BalanceData["metadata"],
  ): void {
    if (metadata.reward_distributor !== expectedAddress) {
      throw new Error(
        `Reward distributor address mismatch: expected ${expectedAddress}, got ${metadata.reward_distributor}`,
      );
    }
  }

  private validateAllBalances(balances: BalanceData["balances"]): void {
    for (const [date, balance] of Object.entries(balances)) {
      this.validateSingleBalance(date, balance);
    }
  }

  private validateSingleBalance(
    date: string,
    balance: BalanceData["balances"][string],
  ): void {
    this.validateDateFormat(date);
    this.validateBlockNumber(balance.block_number);
    this.validateWeiValue(balance.balance_wei, "balance_wei", date);
  }

  private validateOutflowData(address: Address, data: OutflowData): void {
    this.validateOutflowMetadata(address, data.metadata);
    this.validateAllOutflows(data.outflows);
  }

  private validateOutflowMetadata(
    expectedAddress: Address,
    metadata: OutflowData["metadata"],
  ): void {
    if (metadata.reward_distributor !== expectedAddress) {
      throw new Error(
        `Reward distributor address mismatch: expected ${expectedAddress}, got ${metadata.reward_distributor}`,
      );
    }
  }

  private validateAllOutflows(outflows: OutflowData["outflows"]): void {
    for (const [date, outflow] of Object.entries(outflows)) {
      this.validateSingleOutflow(date, outflow);
    }
  }

  private validateSingleOutflow(date: string, outflow: DailyOutflow): void {
    this.validateDateFormat(date);
    this.validateBlockNumber(outflow.block_number);
    this.validateWeiValue(outflow.total_outflow_wei, "total_outflow_wei", date);

    const totalEventWei = this.validateAndSumOutflowEvents(
      outflow.events,
      date,
    );
    this.validateOutflowTotal(date, totalEventWei, outflow.total_outflow_wei);
  }

  private validateAndSumOutflowEvents(
    events: OutflowEvent[],
    date: string,
  ): bigint {
    let totalEventWei = BigInt(0);

    for (const event of events) {
      this.validateOutflowEvent(event, date);
      totalEventWei += BigInt(event.value_wei);
    }

    return totalEventWei;
  }

  private validateOutflowEvent(event: OutflowEvent, date: string): void {
    this.validateChecksummedAddress(
      event.recipient,
      "Recipient address must be checksummed",
    );
    this.validateWeiValue(event.value_wei, "event.value_wei", date);
    this.validateTransactionHash(event.tx_hash);
  }

  private validateChecksummedAddress(
    address: string,
    errorMessage: string,
  ): void {
    if (address !== this.validateAddress(address)) {
      throw new Error(`${errorMessage}: ${address}`);
    }
  }

  private validateOutflowTotal(
    date: string,
    calculatedTotal: bigint,
    declaredTotal: string,
  ): void {
    if (calculatedTotal.toString() !== declaredTotal) {
      throw new Error(
        `Total outflow mismatch for ${date}: expected ${calculatedTotal.toString()}, got ${declaredTotal}`,
      );
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
