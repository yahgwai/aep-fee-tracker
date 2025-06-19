# Distributor Detector Specification

## Overview

The Distributor Detector component discovers all reward distributor contracts created through the ArbOwner precompile. It scans the blockchain for `OwnerActs` events with specific method signatures that indicate distributor creation, then stores metadata about each discovered distributor.

## Purpose

### Primary Objectives

- Discover all reward distributors by scanning `OwnerActs` events
- Identify distributor types based on creation method signatures
- Record complete audit trail for each distributor
- Support incremental discovery of new distributors
- Provide a registry of all distributors for downstream components

### Component Role

- **Position**: Early stage component that provides distributor registry for all other components
- **Consumers**: Balance Fetcher, Event Scanner, Fee Calculator

## Dependencies

- **File Manager**: For reading block numbers and writing distributor data
- **Nova RPC Provider**: For querying logs and chain ID
- **ethers.js**: For RPC communication and address validation

## Data Flow

```
Input: End date (Date object) to scan up to
    ↓
Read last scanned block from FileManager
    ↓
Convert end date to YYYY-MM-DD string format
    ↓
Read block number for end date from FileManager
    ↓
Scan from (last_scanned_block + 1) to end_date_block
    ↓
Query OwnerActs events in this range
    ↓
Filter for distributor creation methods
    ↓
Extract distributor addresses
    ↓
Update distributor data via FileManager with:
  - New distributors found
  - Updated last_scanned_block
    ↓
Output: Updated distributor registry
```

## Contract Background

### ArbOwner Precompile

The ArbOwner precompile at `0x0000000000000000000000000000000000000070` is used to manage various aspects of the Arbitrum Nova network, including creating reward distributors.

### OwnerActs Event

```solidity
event OwnerActs(bytes4 indexed method, address indexed owner, bytes data);
```

This event is emitted whenever the ArbOwner performs an administrative action. The `method` parameter identifies the type of action, and the `data` field contains action-specific information.

### Distributor Creation Methods

The following method signatures indicate distributor creation:

1. **L2 Base Fee Distributor** - `0x57f585db`

   - Method: `setL2BaseFeeRewardRecipient`
   - Data: 32-byte address of the new distributor

2. **L2 Surplus Fee Distributor** - `0xfcdde2b4`

   - Method: `setL2SurplusFeeRewardRecipient`
   - Data: 32-byte address of the new distributor

3. **L1 Surplus Fee Distributor** - `0x934be07d`
   - Method: `setL1SurplusFeeRewardRecipient`
   - Data: 32-byte address of the new distributor

**Note:** L1 Base Fee distributor detection is being skipped for now (see OUTSTANDING.md).

## Public API

### Class Constructor

```typescript
/**
 * Creates a new DistributorDetector instance with the specified dependencies.
 *
 * @param fileManager - File manager instance for data persistence
 * @param provider - Nova provider for RPC calls
 */
class DistributorDetector {
  constructor(
    private readonly fileManager: FileManager,
    private readonly provider: ethers.Provider,
  ) {}
}
```

### Main Method

```typescript
/**
 * Discovers all reward distributors created up to the specified end date.
 * Scans OwnerActs events from the last scanned block to find new distributors.
 * Tracks its own progress to support incremental scanning.
 *
 * @param endDate - Scan up to this date
 * @returns Updated distributor registry data
 * @throws Error if unable to query events or write data
 */
async detectDistributors(endDate: Date): Promise<DistributorsData>;
```

### Public Static Methods

```typescript
/**
 * Scans a specific block range for distributor creation events.
 * Queries OwnerActs events and filters for known method signatures.
 *
 * @param provider - Nova provider for RPC calls
 * @param fromBlock - Starting block (inclusive)
 * @param toBlock - Ending block (inclusive)
 * @returns Array of discovered distributor info
 * @throws Error if RPC query fails
 */
static async scanBlockRange(
  provider: ethers.Provider,
  fromBlock: number,
  toBlock: number,
): Promise<DistributorInfo[]>;

/**
 * Parses OwnerActs event data to extract distributor information.
 * Validates event structure and extracts address from data field.
 *
 * @param log - Raw log entry from eth_getLogs
 * @param blockTimestamp - Timestamp of the block containing the event
 * @returns Parsed distributor info or null if not a creation event
 */
static parseDistributorCreation(
  log: ethers.Log,
  blockTimestamp: number,
): DistributorInfo | null;

/**
 * Determines distributor type from method signature.
 * Maps known method signatures to distributor types.
 *
 * @param methodSig - 4-byte method signature
 * @returns Distributor type or null if unknown
 */
static getDistributorType(methodSig: string): DistributorType | null;

/**
 * Verifies if a contract is a valid reward distributor.
 * Compares deployed bytecode against expected reward distributor bytecode.
 *
 * @param provider - Provider for RPC calls
 * @param address - Contract address to verify
 * @returns True if contract code matches reward distributor bytecode
 */
static async isRewardDistributor(
  provider: ethers.Provider,
  address: string,
): Promise<boolean>;
```

## Algorithm Details

### Event Scanning Process

1. **Load existing data**

   - Read current distributors and last_scanned_block using `fileManager.readDistributors()`
   - If no last_scanned_block exists, start from block 0
   - Read block number for the end date using `fileManager.readBlockNumbers()`, throw error if not present in data
   - If existing data has chain_id, verify it matches provider's chain ID

2. **Determine scan range**

   - From: last_scanned_block + 1 (or 0 if first run)
   - To: block number for the specified end date
   - If from > to, no scanning needed (already up to date)

3. **Query events**

   - Query `OwnerActs` events from ArbOwner precompile
   - Filter by method signatures in topics

4. **Process events**

   - Validate event structure
   - Extract distributor address from data field
   - Determine distributor type from method
   - Record transaction details for audit trail

5. **Verify distributor contract**

   - Get deployed bytecode at distributor address using `provider.getCode(address)`
   - Compare against known reward distributor bytecode
   - Set `is_reward_distributor` to true if bytecode matches exactly
   - Set `is_reward_distributor` to false if bytecode differs

6. **Update registry**
   - Add new distributors (skip if already known)
   - Update last_scanned_block to the end block
   - Preserve all existing distributor data
   - Save updated registry using `fileManager.writeDistributors()` with chain_id from provider

### Event Filtering

The component uses topic filtering to reduce RPC load:

```typescript
const filter = {
  address: "0x0000000000000000000000000000000000000070",
  topics: [
    "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda", // OwnerActs event topic
    [
      // Method signatures (OR filter)
      "0x57f585db", // L2 Base Fee
      "0xfcdde2b4", // L2 Surplus Fee
      "0x934be07d", // L1 Surplus Fee
    ],
  ],
  fromBlock,
  toBlock,
};
```

### Event Parsing and Address Extraction

Parse OwnerActs events to extract method signatures and distributor addresses:

```typescript
import { ethers } from "ethers";

// Define the event ABI
const OWNER_ACTS_ABI = [
  "event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)",
];

// Create interface
const iface = new ethers.Interface(OWNER_ACTS_ABI);

// Example event from the blockchain
const event = {
  topics: [
    "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
    "0xfcdde2b400000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000009c040726f2a657226ed95712245dee84b650a1b5",
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024fcdde2b400000000000000000000000037daa99b1caae0c22670963e103a66ca2c5db2db00000000000000000000000000000000000000000000000000000000",
};

// Parse the event
const parsedLog = iface.parseLog(event);

// Extract values
const method = parsedLog.args.method; // "0xfcdde2b4"
const owner = parsedLog.args.owner; // "0x9C040726F2A657226Ed95712245DeE84b650A1b5"
const eventData = parsedLog.args.data; // "0xfcdde2b4000000..."

// Decode the distributor address from the data field
const distributorAddress = ethers.AbiCoder.defaultAbiCoder().decode(
  ["address"],
  "0x" + eventData.substring(10), // Skip method selector in data
)[0]; // "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
```

### Contract Verification

After extracting the distributor address, verify it's a valid reward distributor:

```typescript
import { REWARD_DISTRIBUTOR_BYTECODE } from "../constants/reward-distributor-bytecode";

// Get deployed bytecode at the address
const deployedCode = await provider.getCode(address);

// Compare against expected reward distributor bytecode
const isRewardDistributor = deployedCode === REWARD_DISTRIBUTOR_BYTECODE;

// Store verification result with distributor info
distributorInfo.is_reward_distributor = isRewardDistributor;
```

**Important Notes:**

- Reference bytecode from contract `0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce` on Nova
- Bytecode comparison must be exact match
- Non-matching bytecode doesn't invalidate the distributor, just flags it
- This verification helps identify if ArbOwner set a non-standard contract as distributor

## Data Structures

### Input Requirements

- End date must have corresponding entry in block numbers data (accessed via `fileManager.readBlockNumbers()`)
- Date is provided as a Date object and converted to YYYY-MM-DD format internally
- Component tracks its own scanning progress in the metadata

### Output Format

Returns a `DistributorsData` object (defined in `src/types/index.ts`):

```typescript
interface DistributorsData {
  metadata: {
    chain_id: number;
    arbowner_address: string; // ArbOwner precompile address
    last_scanned_block?: number; // Tracks scanning progress
  };
  distributors: {
    [address: string]: DistributorInfo;
  };
}

interface DistributorInfo {
  type: DistributorType; // Enum: L2_BASE_FEE, L2_SURPLUS_FEE, L1_SURPLUS_FEE
  block: number;
  date: string; // YYYY-MM-DD format (stored as string for consistency)
  tx_hash: string;
  method: string; // Method signature (e.g., "0x57f585db")
  owner: string;
  event_data: string; // Raw event data field
  is_reward_distributor: boolean; // True if deployed code matches expected reward distributor bytecode
}
```

## Error Handling

All errors should contain context and actionable information to help developers debug and resolve issues. The implementation should handle errors gracefully and provide meaningful messages to assist with troubleshooting.

## Implementation Requirements

### Design Decisions

1. **Static Methods for Testability**
   - Core logic methods (`scanBlockRange`, `parseDistributorCreation`, `getDistributorType`) are public static
   - Enables unit testing without instantiating the full class
   - Allows testing of parsing logic in isolation from RPC/FileManager dependencies

### Performance Optimization

1. **Efficient Filtering**

   - Use topic filters to reduce data transfer
   - Only query specific method signatures
   - Skip processing if no new dates

2. **Incremental Updates**
   - Only scan from last_scanned_block + 1
   - Preserve existing distributor data

### Retry Strategy

The component should use the shared retry utility for all RPC calls to handle transient failures:

```typescript
// Use the shared retry utility for RPC calls
const logs = await retryWithBackoff(() => provider.getLogs(filter));
```

The retry behavior is handled by the shared utility. No custom retry logic is needed in this component.

### Validation Requirements

1. **Address Validation**

   - All addresses must be checksummed using ethers.js
   - Reject zero address or invalid formats
   - Ensure addresses are 20 bytes

2. **Event Validation**

   - Verify event comes from ArbOwner precompile
   - Check method signature is recognized
   - Validate data field length and format

3. **Data Consistency**
   - Never overwrite existing distributor data
   - Ensure date matches actual block date (formatted as YYYY-MM-DD)
   - Verify block numbers are within scanned range

## Usage Example

```typescript
import { DistributorDetector } from "./distributor-detector";
import { FileManager } from "./file-manager";
import { ethers } from "ethers";

// Initialize dependencies
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const fileManager = new FileManager("./store");

// Create DistributorDetector instance
const distributorDetector = new DistributorDetector(fileManager, provider);

// Detect distributors up to end of January 2024
const distributors = await distributorDetector.detectDistributors(
  new Date("2024-01-31"),
);

console.log(
  `Found ${Object.keys(distributors.distributors).length} distributors`,
);
console.log(`Scanned up to block ${distributors.metadata.last_scanned_block}`);
```

## Out of Scope

1. **L1 Base Fee Detection**

   - Add support when method signature is determined
   - Update filtering and type mapping

2. **Parallel Processing**

   - Query multiple date ranges concurrently
   - Implement proper synchronization

3. **Event Caching**

   - Cache raw events for debugging
   - Support event replay without RPC calls

4. **Enhanced Metadata**
   - Track distributor replacement events
   - Record historical distributor changes
   - Add creation transaction gas costs
