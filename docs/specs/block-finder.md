# Block Finder Specification

## Overview

The Block Finder component is responsible for finding the last block before midnight UTC for each date in a given range. It performs binary search to locate these end-of-day blocks and stores them in a JSON file for use by all other components.

## Purpose

- Find end-of-day blocks for a date range using binary search
- Ensure blocks are finalized (older than 1000 blocks) to avoid reorganizations
- Store block numbers persistently for incremental processing
- Enable other components to query data at consistent daily snapshots

## Dependencies

- **File Manager**: For reading/writing block number data
- **Ethereum RPC Provider**: For querying block timestamps
- **ethers.js**: For RPC communication

## Data Flow

```
Input: Date Range (start_date, end_date)
    ↓
Read existing block_numbers.json
    ↓
For each missing date:
    ↓
Binary search for end-of-day block
    ↓
Update block_numbers.json
    ↓
Output: Complete block number mappings
```

## Public API

### Main Function

```typescript
/**
 * Finds end-of-day blocks for all dates in the specified range.
 * Only processes dates that are missing from the stored data.
 * Only processes dates where the end-of-day block would be finalized (>1000 blocks old).
 *
 * @param startDate - First date to process
 * @param endDate - Last date to process
 * @param provider - Ethereum provider for RPC calls
 * @param fileManager - File manager instance for data persistence
 * @returns Object mapping dates to block numbers
 * @throws Error if unable to find blocks or write data
 */
async function findBlocks(
  startDate: Date,
  endDate: Date,
  provider: ethers.Provider,
  fileManager: FileManager,
): Promise<BlockNumberData>;
```

### Helper Functions

```typescript
/**
 * Finds the last block before midnight UTC for a specific date.
 * Uses binary search between bounds to minimize RPC calls.
 *
 * @param date - Date to find block for
 * @param provider - Ethereum provider for RPC calls
 * @param lowerBound - Starting block for search (inclusive)
 * @param upperBound - Ending block for search (inclusive)
 * @returns Block number of last block before midnight
 * @throws Error if unable to find block within bounds
 */
async function findEndOfDayBlock(
  date: Date,
  provider: ethers.Provider,
  lowerBound: number,
  upperBound: number,
): Promise<number>;

/**
 * Gets the current block number minus safety margin.
 * Used to ensure we only process finalized blocks.
 *
 * @param provider - Ethereum provider for RPC calls
 * @returns Current block number minus 1000
 * @throws Error if unable to get current block
 */
async function getSafeCurrentBlock(provider: ethers.Provider): Promise<number>;

/**
 * Determines search bounds for a specific date.
 * Uses previous day's block as lower bound when available.
 *
 * @param date - Date to find bounds for
 * @param existingBlocks - Already known block mappings
 * @param safeCurrentBlock - Maximum block to consider
 * @returns Tuple of [lowerBound, upperBound]
 */
function getSearchBounds(
  date: Date,
  existingBlocks: BlockNumberData,
  safeCurrentBlock: number,
): [number, number];
```

## Algorithm Details

### Binary Search Algorithm

```typescript
// Uses standard binary search to find the last block before midnight UTC.
// Searches between lowerBound and upperBound, checking block timestamps.
// Returns the highest block number whose timestamp is before the target midnight.
```

### Date Processing Logic

1. Parse start and end dates
2. Generate all dates in range
3. Load existing block numbers
4. If existing data has chain_id, verify it matches `(await provider.getNetwork()).chainId`
5. Filter out dates that already have blocks
6. Filter out dates too recent to be finalized
7. Process remaining dates in order
8. Save after each successful block found with chain_id from provider

### Reorg Protection

- Only process dates where end-of-day block is > 1000 blocks old
- This ensures ~3.5 hours have passed since the block was mined
- Arbitrum typically finalizes within minutes, so this is very conservative

## Error Handling

### Error Types

1. **RPC Errors**

   - Connection timeouts
   - Rate limiting
   - Invalid responses

2. **Search Errors**

   - No block found within bounds
   - Timestamp inconsistencies
   - Invalid date ranges

3. **Data Errors**

   - Chain ID mismatch between provider and stored data

4. **File System Errors**
   - Unable to read existing data
   - Unable to write updates

### Error Messages

All errors must include:

- Operation that failed
- Input values (date, bounds)
- Actual error from RPC/filesystem
- Suggested resolution

Example:

```
Error: Failed to find end-of-day block
  Date: 2024-01-15
  Target: Before 2024-01-16T00:00:00Z
  Search bounds: 100000000 to 100100000
  Last checked: Block 100050000 at 2024-01-16T00:15:00Z
  Error: All blocks in range are after midnight
  Check: Expand search bounds or verify date is valid
```

## Implementation Requirements

### Input Validation

- Start date must not be after end date
- Dates must be valid Date objects
- Provider must be connected

### Performance Optimization

- Binary search minimizes RPC calls (O(log n) per date)
- Process dates sequentially to maintain order
- Save after each block to enable interruption/resume
- Reuse provider connection across all searches

### Retry Strategy

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * Math.pow(2, i));
      }
    }
  }

  throw lastError;
}
```

## Usage Example

```typescript
import { BlockFinder } from "./block-finder";
import { FileManager } from "./file-manager";
import { ethers } from "ethers";

// Initialize dependencies
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const fileManager = new FileManager("./store");

// Find blocks for date range
const blocks = await BlockFinder.findBlocks(
  new Date("2024-01-01"),
  new Date("2024-01-31"),
  provider,
  fileManager,
);

console.log(`Found blocks for ${Object.keys(blocks).length} dates`);
```

## Testing Notes

For integration and end-to-end tests, use the public Arbitrum One RPC endpoint: `https://arb1.arbitrum.io/rpc`

This provides access to real historical data without requiring a private archive node during development.

## Out of Scope

1. **Parallel Processing** - Dates are processed sequentially
2. **Caching** - No in-memory caching of block timestamps
3. **Adaptive Bounds** - Uses fixed estimation for block ranges
4. **Progress Reporting** - No callback mechanism for progress updates
