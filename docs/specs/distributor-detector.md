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
- **Dependencies**: File Manager, Block Finder data, Nova RPC provider
- **Consumers**: Balance Fetcher, Event Scanner, Fee Calculator

## Dependencies

- **File Manager**: For reading block numbers and writing distributor data
- **Block Numbers**: Must have block mappings before scanning
- **Nova RPC Provider**: For querying logs
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

1. **L2 Base Fee Distributor** - `0xee95a824`

   - Method: `setL2BaseFeeRewardRecipient`
   - Data: 32-byte address of the new distributor

2. **L2 Surplus Fee Distributor** - `0x2d9125e9`

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
   - If existing data has chain_id, verify it matches `(await provider.getNetwork()).chainId`

2. **Determine scan range**

   - From: last_scanned_block + 1 (or 0 if first run)
   - To: block number for the specified end date
   - If from > to, no scanning needed (already up to date)

3. **Query events**

   - Query `OwnerActs` events from ArbOwner precompile
   - Filter by method signatures in topics
   - Process in batches to handle RPC limits

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
   - Save updated registry using `fileManager.writeDistributors()` with chain_id from `(await provider.getNetwork()).chainId`

### Event Filtering

The component uses topic filtering to reduce RPC load:

```typescript
const filter = {
  address: "0x0000000000000000000000000000000000000070",
  topics: [
    "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda", // OwnerActs event topic
    [
      // Method signatures (OR filter)
      "0xee95a824", // L2 Base Fee
      "0x2d9125e9", // L2 Surplus Fee
      "0x934be07d", // L1 Surplus Fee
    ],
  ],
  fromBlock,
  toBlock,
};
```

### Address Extraction

Distributor addresses are encoded in the event data field:

```typescript
// Data field contains 32-byte padded address
// Example: 0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9
const address = "0x" + log.data.slice(26); // Remove padding
const checksummed = ethers.getAddress(address); // Validate and checksum
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
    chain_id: number; // Retrieved from provider.getNetwork().chainId
    arbowner_address: string; // Always "0x0000000000000000000000000000000000000070"
    last_scanned_block?: number; // Updated after each scan
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
  method: string; // Method signature (e.g., "0xee95a824")
  owner: string; // Always the ArbOwner address
  event_data: string; // Raw event data field
  is_reward_distributor: boolean; // True if deployed code matches expected reward distributor bytecode
}
```

## Error Handling

### Error Types

1. **RPC Errors**

   - Connection failures
   - Rate limiting
   - Invalid responses
   - Missing historical data

2. **Data Errors**

   - Missing block numbers
   - Invalid event structure
   - Malformed addresses
   - Unknown method signatures
   - Chain ID mismatch between provider and stored data

3. **FileManager Errors**
   - Unable to read data via FileManager
   - Unable to write data via FileManager
   - Data validation failures

### Error Messages

All errors must provide context and actionable information:

```
Error: Failed to query OwnerActs events
  Block range: 12345678 to 12356789
  Last scanned: 12345677
  Target end date: 2024-01-15
  RPC Error: rate limit exceeded
  Suggestion: Reduce batch size or add delay between requests
```

```
Error: Invalid distributor address in event
  Transaction: 0xabc123...
  Block: 12345678
  Data field: 0x1234... (invalid length)
  Expected: 32-byte padded address
```

```
Error: Chain ID mismatch
  Provider chain ID: 1
  Stored chain ID: 42170
  Suggestion: Ensure you're connected to Nova network (chain ID 42170)
```

## Implementation Requirements

### Design Decisions

1. **Static Methods for Testability**
   - Core logic methods (`scanBlockRange`, `parseDistributorCreation`, `getDistributorType`) are public static
   - Enables unit testing without instantiating the full class
   - Allows testing of parsing logic in isolation from RPC/FileManager dependencies

### Performance Optimization

1. **Batch Processing**

   - Query multiple blocks in single RPC call where possible
   - Use reasonable block range sizes (e.g., 10,000 blocks)
   - Implement pagination for large result sets

2. **Efficient Filtering**

   - Use topic filters to reduce data transfer
   - Only query specific method signatures
   - Skip processing if no new dates

3. **Incremental Updates**
   - Only scan from last_scanned_block + 1
   - Preserve existing distributor data
   - Track progress to enable resume after interruption

### Retry Strategy

The component should use the shared retry utility for all RPC calls to handle transient failures:

```typescript
const MAX_BLOCK_RANGE = 10000; // Prevent overwhelming RPC

// Use the shared retry utility for RPC calls
const logs = await retryWithBackoff(() => provider.getLogs(filter));
```

Configuration:

- Maximum block range per query: 10,000 blocks
- Retry behavior is handled by the shared utility
- No custom retry logic needed in this component

### Validation Requirements

1. **Chain ID Validation**

   - Fetch chain ID from provider using `(await provider.getNetwork()).chainId`
   - Verify chain ID matches stored metadata if data exists

2. **Address Validation**

   - All addresses must be checksummed using ethers.js
   - Reject zero address or invalid formats
   - Ensure addresses are 20 bytes

3. **Event Validation**

   - Verify event comes from ArbOwner precompile
   - Check method signature is recognized
   - Validate data field length and format

4. **Data Consistency**
   - Never overwrite existing distributor data
   - Ensure date matches actual block date (formatted as YYYY-MM-DD)
   - Verify block numbers are within scanned range

## Testing Requirements

### Unit Tests

1. **Event Parsing** (using static methods)

   - Test `parseDistributorCreation()` with valid OwnerActs events
   - Test rejection of malformed events
   - Test `getDistributorType()` for all distributor types

2. **Address Extraction** (via `parseDistributorCreation()`)

   - Test extraction from properly padded data
   - Test checksum validation
   - Test invalid address formats

3. **Block Range Scanning** (using `scanBlockRange()`)

   - Test querying events in a specific range
   - Test handling of empty ranges
   - Test batch processing and pagination

4. **Progress Tracking**
   - Test resuming from last_scanned_block
   - Test first run (no previous scan)
   - Test when already up to date

### Integration Tests

1. **RPC Integration**

   - Test with real Nova RPC endpoint
   - Verify known historical distributors
   - Test error handling when RPC calls fail after retries are exhausted

2. **FileManager Integration**
   - Test reading block numbers via FileManager
   - Test updating distributor registry via FileManager
   - Test preserving existing data

### Test Scenarios

1. **New Distributor Discovery**

   - Scan range with known new distributor
   - Verify correct extraction and storage
   - Check all metadata fields

2. **Incremental Updates**

   - Run detector multiple times
   - Verify it resumes from last_scanned_block
   - Ensure no duplicates or missed blocks

3. **Multiple Distributors**

   - Scan range with multiple creation events
   - Verify all are discovered
   - Check correct type assignment

4. **Edge Cases**
   - Already up to date (last_scanned_block >= end_date_block)
   - No events in range
   - Very large block ranges
   - Multiple distributors in same block

## Security Considerations

1. **Input Validation**

   - Validate all dates before processing
   - Ensure provider is connected
   - Check file permissions before writing

2. **Address Security**

   - Always use checksummed addresses
   - Validate against zero address
   - Ensure addresses are properly formatted

3. **Event Authenticity**
   - Only process events from ArbOwner precompile
   - Verify event structure matches expected format
   - Validate method signatures are known

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
