// Re-export utility functions
export { withRetry, type RetryOptions } from "../utils/retry";

// Core Data Types

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
  discovered_block: number;
  discovered_date: string;
  tx_hash: string;
  method: string;
  owner: string;
  event_data: string;
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

export interface OutflowData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  outflows: {
    [date: string]: DailyOutflow;
  };
}

export interface DailyOutflow {
  block_number: number;
  total_outflow_wei: string;
  events: OutflowEvent[];
}

export interface OutflowEvent {
  recipient: string;
  value_wei: string;
  tx_hash: string;
}

// Utility Types
export type DateString = string;
export type Address = string;
export type TxHash = string;

// Constants
export const DISTRIBUTOR_METHODS = {
  L2_BASE_FEE: "0xee95a824",
  L2_SURPLUS_FEE: "0x2d9125e9",
  L1_SURPLUS_FEE: "0x934be07d",
} as const;

export type DistributorMethod =
  (typeof DISTRIBUTOR_METHODS)[keyof typeof DISTRIBUTOR_METHODS];

export const CONTRACTS = {
  ARB_OWNER: "0x0000000000000000000000000000000000000070",
  ARB_INFO: "0x000000000000000000000000000000000000006D",
} as const;

export const CHAIN_IDS = {
  ARBITRUM_ONE: 42161,
  ARBITRUM_NOVA: 42170,
} as const;

export const STORE_DIR = "store";
export const DISTRIBUTORS_DIR = "distributors";

// Component Interfaces
export interface FileManager {
  readBlockNumbers(): BlockNumberData | undefined;
  writeBlockNumbers(data: BlockNumberData): void;
  readDistributors(): DistributorsData | undefined;
  writeDistributors(data: DistributorsData): void;
  readDistributorBalances(address: Address): BalanceData | undefined;
  writeDistributorBalances(address: Address, data: BalanceData): void;
  readDistributorOutflows(address: Address): OutflowData | undefined;
  writeDistributorOutflows(address: Address, data: OutflowData): void;
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
