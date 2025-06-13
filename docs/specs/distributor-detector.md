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
- **Dependencies**: File Manager, Block Finder data, Ethereum RPC provider
- **Consumers**: Balance Fetcher, Event Scanner, Fee Calculator

## Dependencies

- **File Manager**: For reading block numbers and writing distributor data
- **Block Numbers**: Must have block mappings before scanning
- **Ethereum RPC Provider**: For querying logs
- **ethers.js**: For RPC communication and address validation

## Data Flow

```
Input: End date to scan up to
    ↓
Read last scanned block from distributors.json
    ↓
Read block number for end date from block_numbers.json
    ↓
Scan from (last_scanned_block + 1) to end_date_block
    ↓
Query OwnerActs events in this range
    ↓
Filter for distributor creation methods
    ↓
Extract distributor addresses
    ↓
Update distributors.json with:
  - New distributors found
  - Updated last_scanned_block
    ↓
Output: Updated distributor registry
```

## Contract Background

### ArbOwner Precompile

The ArbOwner precompile at `0x0000000000000000000000000000000000000070` is used to manage various aspects of the Arbitrum network, including creating reward distributors.

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

### Main Function

```typescript
/**
 * Discovers all reward distributors created up to the specified end date.
 * Scans OwnerActs events from the last scanned block to find new distributors.
 * Tracks its own progress to support incremental scanning.
 *
 * @param endDate - Scan up to this date (YYYY-MM-DD format)
 * @param provider - Ethereum provider for RPC calls
 * @param fileManager - File manager instance for data persistence
 * @returns Updated distributor registry data
 * @throws Error if unable to query events or write data
 */
async function detectDistributors(
  endDate: string,
  provider: ethers.Provider,
  fileManager: FileManager,
): Promise<DistributorsData>;
```

### Helper Functions

```typescript
/**
 * Scans a specific block range for distributor creation events.
 * Queries OwnerActs events and filters for known method signatures.
 *
 * @param fromBlock - Starting block (inclusive)
 * @param toBlock - Ending block (inclusive)
 * @param provider - Ethereum provider for RPC calls
 * @returns Array of discovered distributor info
 * @throws Error if RPC query fails
 */
async function scanBlockRange(
  fromBlock: number,
  toBlock: number,
  provider: ethers.Provider,
): Promise<DistributorInfo[]>;

/**
 * Parses OwnerActs event data to extract distributor information.
 * Validates event structure and extracts address from data field.
 *
 * @param log - Raw log entry from eth_getLogs
 * @returns Parsed distributor info or null if not a creation event
 */
function parseDistributorCreation(log: ethers.Log): DistributorInfo | null;

/**
 * Determines distributor type from method signature.
 * Maps known method signatures to distributor types.
 *
 * @param methodSig - 4-byte method signature
 * @returns Distributor type or null if unknown
 */
function getDistributorType(methodSig: string): DistributorType | null;
```

## Algorithm Details

### Event Scanning Process

1. **Load existing data**

   - Read current distributors and last_scanned_block from `distributors.json`
   - If no last_scanned_block exists, start from block 0
   - Read block number for the end date from `block_numbers.json`
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

5. **Update registry**
   - Add new distributors (skip if already known)
   - Update last_scanned_block to the end block
   - Preserve all existing distributor data
   - Save updated registry atomically with chain_id from `(await provider.getNetwork()).chainId`

### Event Filtering

The component uses topic filtering to reduce RPC load:

```typescript
const filter = {
  address: "0x0000000000000000000000000000000000000070",
  topics: [
    null, // Event signature (OwnerActs)
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

## Data Structures

### Input Requirements

- End date must have corresponding entry in `block_numbers.json`
- Date must be in YYYY-MM-DD format
- Component tracks its own scanning progress

### Output Format

Updates the `distributors.json` file with discovered distributors:

```json
{
  "metadata": {
    "chain_id": 42161, // Retrieved from provider.getNetwork().chainId
    "arbowner_address": "0x0000000000000000000000000000000000000070",
    "last_scanned_block": 12356789
  },
  "distributors": {
    "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
      "type": "L2_BASE_FEE",
      "discovered_block": 12345678,
      "discovered_date": "2024-01-15",
      "tx_hash": "0xabc123...",
      "method": "0xee95a824",
      "owner": "0x0000000000000000000000000000000000000070",
      "event_data": "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9"
    }
  }
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

3. **File System Errors**
   - Unable to read input files
   - Unable to write output
   - Corrupted JSON data

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
  Provider chain ID: 42170
  Stored chain ID: 42161
  Suggestion: Ensure you're connected to the same network as the stored data
```

## Implementation Requirements

### Performance Optimization

1. **Batch Processing**

   - Query multiple dates in single RPC call where possible
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

```typescript
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_BLOCK_RANGE = 10000; // Prevent overwhelming RPC

async function queryWithRetry(
  provider: ethers.Provider,
  filter: ethers.Filter,
  retries: number = MAX_RETRIES,
): Promise<ethers.Log[]> {
  try {
    return await provider.getLogs(filter);
  } catch (error) {
    if (retries > 0) {
      const delay = INITIAL_DELAY * Math.pow(2, MAX_RETRIES - retries);
      await sleep(delay);
      return queryWithRetry(provider, filter, retries - 1);
    }
    throw error;
  }
}
```

### Validation Requirements

1. **Chain ID Validation**

   - Fetch chain ID from provider using `(await provider.getNetwork()).chainId`
   - Verify chain ID matches stored metadata if data exists
   - Ensure we're on a supported Arbitrum chain (42161 or 42170)

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
   - Ensure discovered_date matches actual block date
   - Verify block numbers are within scanned range

## Testing Requirements

### Unit Tests

1. **Event Parsing**

   - Test parsing of valid OwnerActs events
   - Test rejection of malformed events
   - Test all distributor types

2. **Address Extraction**

   - Test extraction from properly padded data
   - Test checksum validation
   - Test invalid address formats

3. **Progress Tracking**
   - Test resuming from last_scanned_block
   - Test first run (no previous scan)
   - Test when already up to date

### Integration Tests

1. **RPC Integration**

   - Test with real Arbitrum RPC endpoint
   - Verify known historical distributors
   - Test retry logic with rate limits

2. **File Integration**
   - Test reading block numbers
   - Test updating distributor registry
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

// Detect distributors up to end of January 2024
const distributors = await DistributorDetector.detectDistributors(
  "2024-01-31",
  provider,
  fileManager,
);

console.log(
  `Found ${Object.keys(distributors.distributors).length} distributors`,
);
console.log(`Scanned up to block ${distributors.metadata.last_scanned_block}`);
```

## Future Enhancements

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
