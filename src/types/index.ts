// Core Data Types

export interface Configuration {
  storeDirectory: string;
  rpcUrl: string;
  startDate?: string;
  endDate?: string;
}

export interface BlockNumberData {
  metadata: {
    chain_id: number;
  };
  blocks: {
    [date: string]: number;
  };
}

export enum DistributorType {
  L2_BASE_FEE = "L2_BASE_FEE",
  L2_SURPLUS_FEE = "L2_SURPLUS_FEE",
  L1_SURPLUS_FEE = "L1_SURPLUS_FEE",
  L1_BASE_FEE = "L1_BASE_FEE",
}

export interface DistributorsData {
  metadata: {
    chain_id: number;
    arbowner_address: string;
    last_scanned_block?: number;
  };
  distributors: {
    [address: string]: DistributorInfo;
  };
}

export interface DistributorInfo {
  type: DistributorType;
  block: number;
  date: string;
  tx_hash: string;
  method: string;
  owner: string;
  event_data: string;
  is_reward_distributor: boolean;
  distributor_address: string;
}

export interface BalanceData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  balances: {
    [date: string]: {
      block_number: number;
      balance_wei: string;
    };
  };
}

export interface RecipientRecievedEvent {
  // Raw event data
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  address: string; // Contract address that emitted the event
  topics: string[]; // Raw event topics
  data: string; // Raw event data

  // Parsed fields
  recipient: string; // Checksummed recipient address
  value: string; // Decimal string representation of value
}

export interface RecipientRecievedEventData {
  metadata: {
    chain_id: number; // Network chain ID
    reward_distributor: string; // Distributor contract address
    last_scanned_block: number; // Last block that was successfully scanned
  };
  events: {
    [key: string]: RecipientRecievedEvent; // Key format: "transactionHash:logIndex"
  };
}

export interface FeeReport {
  metadata: {
    chain_id: number; // Network chain ID
  };
  distributors: {
    [distributorAddress: string]: Array<{
      date: string; // Date in YYYY-MM-DD format
      start_balance_wei: string; // Balance at start of day
      end_balance_wei: string; // Balance at end of day
      balance_change_wei: string; // Change in balance (can be negative)
      distributions_wei: string; // Total distributions for the day
      distributions_count: number; // Number of distribution events
      total_wei: string; // Total fees collected (balance_change + distributions)
    }>;
  };
}

// Utility Types
export type DateString = string;
export type Address = string;
export type TxHash = string;

// Component Interfaces
export interface FileManager {
  readBlockNumbers(): BlockNumberData | undefined;
  writeBlockNumbers(data: BlockNumberData): void;
  readDistributors(): DistributorsData | undefined;
  writeDistributors(data: DistributorsData): void;
  readDistributorBalances(address: Address): BalanceData | undefined;
  writeDistributorBalances(address: Address, data: BalanceData): void;
  readRecipientRecievedEvents(
    address: Address,
  ): RecipientRecievedEventData | undefined;
  writeRecipientRecievedEvents(
    address: Address,
    data: RecipientRecievedEventData,
  ): void;
  readFeeReport(): FeeReport | undefined;
  writeFeeReport(report: FeeReport): void;
  ensureStoreDirectory(): void;
  validateAddress(address: string): Address;
  formatDate(date: Date): DateString;
  validateDateFormat(date: string): void;
  validateBlockNumber(blockNumber: number): void;
  validateWeiValue(value: string, field?: string, date?: string): void;
  validateTransactionHash(txHash: string): void;
  validateEnumValue(
    value: string,
    enumName: string,
    validValues: string[],
  ): void;
  getMaxDateFromBlockStore(): Date | null;
  getMinDateFromBlockStore(): Date | null;
}

// Error Types
export class FileManagerError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "FileManagerError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly expected: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class BlockFinderError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly context: {
      date?: string;
      searchBounds?: { lower: number; upper: number };
      lastCheckedBlock?: { number: number; timestamp: Date };
      targetTimestamp?: Date;
      retryAttempt?: number;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = "BlockFinderError";
  }
}

export class RPCError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly retryCount: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RPCError";
  }
}

// Type Guards
export function isValidDistributorType(type: string): type is DistributorType {
  return Object.values(DistributorType).includes(type as DistributorType);
}

export function isValidDateString(date: string): date is DateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function isValidDecimalString(value: string): boolean {
  return /^\d+$/.test(value);
}
