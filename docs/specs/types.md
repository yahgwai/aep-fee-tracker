# Shared Types Specification

## Overview

This document defines all TypeScript interfaces and types shared across the AEP Fee Calculator components. These types ensure type safety and consistency when working with file data and component interfaces.

## Core Data Types

### Block Number Data

```typescript
interface BlockNumberData {
  metadata: {
    chain_id: number;
  };
  blocks: {
    [date: string]: number; // date format: "YYYY-MM-DD"
  };
}
```

### Distributor Data

```typescript
enum DistributorType {
  L2_BASE_FEE = "L2_BASE_FEE",
  L2_SURPLUS_FEE = "L2_SURPLUS_FEE",
  L1_SURPLUS_FEE = "L1_SURPLUS_FEE",
  L1_BASE_FEE = "L1_BASE_FEE" // Note: Skipping L1_BASE_FEE detection for now
}

interface DistributorsData {
  metadata: {
    chain_id: number;
    arbowner_address: string;
  };
  distributors: {
    [address: string]: DistributorInfo;
  };
}

interface DistributorInfo {
  type: DistributorType;
  discovered_block: number;
  discovered_date: string; // format: "YYYY-MM-DD"
  tx_hash: string;
  method: string; // "0xee95a824" | "0x2d9125e9" | "0x934be07d"
  owner: string;
  event_data: string;
}
```

### Balance Data

```typescript
interface BalanceData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  balances: {
    [date: string]: {
      block_number: number;
      balance_wei: string; // Stored as decimal string to prevent precision loss
    };
  };
}
```

### Outflow Data

```typescript
interface OutflowData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  outflows: {
    [date: string]: DailyOutflow;
  };
}

interface DailyOutflow {
  block_number: number;
  total_outflow_wei: string; // Stored as decimal string to prevent precision loss
  events: OutflowEvent[];
}

interface OutflowEvent {
  recipient: string;
  value_wei: string; // Stored as decimal string to prevent precision loss
  tx_hash: string;
}
```

## Utility Types

### Date String

```typescript
// Type alias for clarity - represents "YYYY-MM-DD" format
type DateString = string;
```

### Address Types

```typescript
// Type alias for Ethereum addresses - should be checksummed
type Address = string;

// Type alias for transaction hashes
type TxHash = string;
```

### Method Signatures

```typescript
// Known method signatures for distributor creation
const DISTRIBUTOR_METHODS = {
  L2_BASE_FEE: "0xee95a824",
  L2_SURPLUS_FEE: "0x2d9125e9",
  L1_SURPLUS_FEE: "0x934be07d"
  // L1_BASE_FEE: TBD - skipping for now
} as const;

type DistributorMethod = typeof DISTRIBUTOR_METHODS[keyof typeof DISTRIBUTOR_METHODS];
```

## Component Interfaces

### File Manager Interface

```typescript
interface FileManager {
  // Block number operations
  readBlockNumbers(): Promise<BlockNumberData>;
  writeBlockNumbers(data: BlockNumberData): Promise<void>;
  
  // Distributor operations
  readDistributors(): Promise<DistributorsData>;
  writeDistributors(data: DistributorsData): Promise<void>;
  
  // Per-distributor data operations
  readDistributorBalances(address: Address): Promise<BalanceData>;
  writeDistributorBalances(address: Address, data: BalanceData): Promise<void>;
  
  readDistributorOutflows(address: Address): Promise<OutflowData>;
  writeDistributorOutflows(address: Address, data: OutflowData): Promise<void>;
  
  // Utility methods
  ensureStoreDirectory(): Promise<void>;
  validateAddress(address: string): Address;
  formatDate(date: Date): DateString;
}
```

## Error Types

```typescript
// Custom error for file manager operations
class FileManagerError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "FileManagerError";
  }
}

// Custom error for validation failures
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly expected: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
```

## Constants

```typescript
// Known contract addresses
const CONTRACTS = {
  ARB_OWNER: "0x0000000000000000000000000000000000000070",
  ARB_INFO: "0x000000000000000000000000000000000000006D"
} as const;

// Chain IDs
const CHAIN_IDS = {
  ARBITRUM_ONE: 42161,
  ARBITRUM_NOVA: 42170
} as const;

// File paths
const STORE_DIR = "store";
const DISTRIBUTORS_DIR = "distributors";
```

## Type Guards

```typescript
// Type guard for distributor type validation
function isValidDistributorType(type: string): type is DistributorType {
  return Object.values(DistributorType).includes(type as DistributorType);
}

// Type guard for date string validation
function isValidDateString(date: string): date is DateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// Type guard for decimal string validation (no scientific notation)
function isValidDecimalString(value: string): boolean {
  return /^\d+$/.test(value);
}
```

## Usage Guidelines

### Importing Types

```typescript
// In component files
import { 
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  DistributorType,
  Address,
  DateString
} from '../types';
```

### Working with Wei Values

```typescript
// Always use strings for wei values
const balance: string = "1000000000000000000000"; // 1000 ETH

// Never use numbers for wei values
// BAD: const balance: number = 1000000000000000000000;
```

### Address Handling

```typescript
// Always checksum addresses before storing
import { getAddress } from 'ethers';

const checksummed: Address = getAddress(userInput);
```

### Date Formatting

```typescript
// Always use UTC and YYYY-MM-DD format
function formatDate(date: Date): DateString {
  return date.toISOString().split('T')[0];
}
```

