# AEP Fee Calculator Architecture

## Overview

A modular TypeScript application that calculates fees collected by Arbitrum reward distributors. The system consists of five processing components plus a core File Manager component, all operating independently and communicating only through JSON files on disk.

## Data Flow

```
Date Range → block-finder → store/block_numbers.json
                                ↓
                    distributor-detector → store/distributors.json
                                              ↓
                                    (for each distributor)
                                              ↓
                                    balance-fetcher → store/distributors/{address}/balances.json
                                              ↓
                                    event-scanner → store/distributors/{address}/outflows.json
                                              ↓
                                    fee-calculator → Fee Report

Note: All file operations go through the File Manager component for atomic updates
      Components 3-5 only process dates that exist in block_numbers.json
```

## Design Principles

1. **File-Based Communication**: Components share data only via JSON files
2. **Fail-Fast**: Any error causes immediate termination - no partial data
3. **Incremental Processing**: Supports both initial backfill and daily updates
4. **Single Responsibility**: Each component has one specific task
5. **Reorg Protection**: Only query blocks older than 1000 blocks (~3.5 hours) to avoid chain reorganizations
6. **Clear Error Messages**: Every error must include context, values, and actionable next steps for debugging

## Components

### 1. File Manager (`file-manager.ts`)

Abstracts all file operations so components can work with typed data without handling serialization, paths, or I/O details.

**Component Dependencies:**

- Used by: All other components (2-6)
- Depends on: Node.js fs module only
- Must be implemented first

**Core Value:**

- Components request/store typed objects, not JSON strings
- File paths and naming conventions are encapsulated
- Serialization/deserialization happens transparently
- Schema validation ensures type safety
- Single source of truth for all file operations

**Key Methods:**

- `readBlockNumbers(): BlockNumberMap` - Returns typed block data
- `writeDistributor(address: string, data: DistributorData): void` - Stores distributor info
- `updateBalances(address: string, balances: BalanceMap): void` - Updates balance data
- All methods handle paths, serialization, and error cases internally

**Implementation Details:**

- Validates data against TypeScript interfaces before writing
- Creates directories as needed
- Returns empty objects for missing files (where appropriate)
- Handles all file I/O errors with clear messages

**File Organization:**

```
store/
  ├── block_numbers.json              # Master list of date to block mappings
  ├── distributors.json               # List of discovered distributor addresses with metadata
  └── distributors/
      └── {address}/                  # One directory per distributor
          ├── balances.json           # End-of-day balances
          └── outflows.json           # Daily outflow events and totals
```

This structure allows:

- Independent processing per distributor
- Easy addition of new distributors
- Parallel processing of different distributors
- Efficient incremental updates
- Pre-calculated totals for performance optimization

### 2. Block Finder (`block-finder.ts`)

Finds the last block before midnight UTC for each date.

**Process:**

- For missing dates, performs binary search to find block
- Only processes dates where the end-of-day block is at least 1000 blocks old
- Updates `store/block_numbers.json` with new entries

**Algorithm:**

```
Binary search between:
- Lower bound: Previous day's block (or 0 if first day)
- Upper bound: Next day's estimated block (or current block - 1000)
- Target: Last block where timestamp < midnight UTC
```

### 3. Distributor Detector (`distributor-detector.ts`)

Discovers reward distributor addresses through `OwnerActs` events.

**Process:**

- Reads block ranges from `store/block_numbers.json`
- Queries ArbOwner precompile for `OwnerActs` events
- Filters for distributor creation methods:
  - `0xee95a824` - L2 Base Fee
  - `0x2d9125e9` - L2 Surplus Fee
  - `0x934be07d` - L1 Surplus Fee
- Extracts distributor addresses and stores complete event information

**Note:** L1_BASE_FEE detection is being skipped for now (see OUTSTANDING.md)

**Output:**

- Creates directories for new distributors
- Updates `store/distributors.json` with all discovered distributors

**Event Structure:**

```solidity
event OwnerActs(bytes4 indexed method, address indexed owner, bytes data);
```

### 4. Balance Fetcher (`balance-fetcher.ts`)

Retrieves reward distributor balances at end-of-day blocks.

**Why separate from Event Scanner?**

- Different RPC methods (`eth_getBalance` vs `eth_getLogs`)
- Different retry strategies (balance queries are simpler)
- Can be parallelized across distributors
- Balance fetching is idempotent, event scanning requires careful range management
- Separation allows independent testing and debugging

**Process:**

- Reads distributor list from `store/distributors.json`
- For each distributor:
  - Reads master `store/block_numbers.json` for blocks to query (from creation date onward)
  - Only processes dates present in block_numbers.json
  - Fetches balance for each date:block combination
  - Updates `store/distributors/{address}/balances.json`

### 5. Event Scanner (`event-scanner.ts`)

Collects `RecipientRecieved` events for each day.
**Note:** The misspelling of "Received" as "Recieved" is intentional - this is how the event is defined in the deployed contract.

**Process:**

- Reads distributor list from `store/distributors.json`
- For each distributor:
  - Reads master `store/block_numbers.json` for block ranges (from creation date onward)
  - Only processes dates present in block_numbers.json
  - Queries logs for each date range (previous day's block + 1 to current day's block)
  - Aggregates events and calculates totals
  - Updates `store/distributors/{address}/outflows.json`

### 6. Fee Calculator (`fee-calculator.ts`)

Computes daily and cumulative fees from stored data.

**Process:**

- Reads distributor list from `store/distributors.json`
- For each distributor reads balances and outflows
- Calculates daily fees: balance changes + outflows
- Calculates cumulative fees
- Outputs combined results

## File Schemas

See the [File Manager Specification](specs/file-manager.md#data-schemas) for detailed JSON schemas and data structures.

## Environment Variables

- `RPC_URL`: Arbitrum archive node endpoint
- `CHAIN_ID`: Network identifier
- `START_DATE`: Optional override for backfill start
- `END_DATE`: Optional override for processing end

## Execution Model

Components are orchestrated through a CLI that handles configuration, execution order, and error handling.

### Initial Backfill

1. Run block-finder to create master block number list
2. Run distributor-detector to find all historical distributors
3. For each distributor, run balance-fetcher and event-scanner
4. May take hours for multiple years

### Daily Updates

1. Cron job triggers script daily
2. Run block-finder to update master list
3. Run distributor-detector to check for new distributors
4. For each distributor, process only new dates
5. Completes in minutes

## Shared Components

### Core Infrastructure

- **File Manager**: First-class component for all file operations (see section 6 above)
- **Types**: Shared TypeScript interfaces for data structures

### External Libraries

- **ethers.js**: Standard Ethereum RPC interface
- **Node.js built-ins**: Date/time operations, file system, etc.

### Utilities

- **Logger**: Console-based logging with consistent format

### No Shared State

Components communicate only through files to ensure independent development, testing, and deployment.

## Error Handling

### Strategy

- **RPC Failures**: Retry 3 times with exponential backoff, then exit
- **Invalid Data**: Exit immediately with error message
- **File I/O**: Exit if unable to read/write files
- **No Partial Updates**: Files only updated after successful processing

### Error Message Requirements

Every error message must include:

1. **What failed**: The specific operation that failed
2. **Why it failed**: The underlying cause
3. **Context values**: Relevant data (block numbers, addresses, file paths)
4. **Next steps**: What the user should check or try

Example:

```
Error: Failed to fetch balance for distributor
  Distributor: 0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9
  Block: 12345678
  RPC Error: connection timeout after 3 retries
  Check: Ensure RPC_URL is accessible and archive node has block 12345678
```

## Testing Philosophy

### Unit Tests

Each component should have comprehensive unit tests that:

- Test core logic against a real provider (testnet or local fork)
- Use actual file I/O to verify atomic operations work correctly
- Verify error handling paths with real failure scenarios
- Use deterministic test data from known blockchain states

### Integration Tests

Test data flow between components:

- Verify file formats are correctly read/written
- Test component interaction through files
- Validate incremental processing works correctly

### End-to-End Tests

Small-scale scenarios that run all components:

- Use a test date range (e.g., one week)
- Verify final calculations are correct
- Test both initial backfill and incremental update paths

### Test Data

- Maintain fixtures for known blockchain states
- Include edge cases (new distributor mid-day, no events, etc.)
- Version test data with the code
