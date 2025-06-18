# File Manager Component Specification

## Overview

The File Manager is the foundational component of the AEP Fee Calculator, providing a unified interface for all file operations. It serves as the single source of truth for data persistence, abstracting file paths, JSON serialization, and atomic updates from other components.

## Purpose

### Primary Objectives

- Provide type-safe interfaces for reading and writing all system data
- Ensure atomic updates to prevent partial/corrupted data
- Handle all file I/O errors with actionable error messages
- Enforce data schemas through TypeScript interfaces
- Centralize file path management and directory structure

### Component Role

- **Position**: Core infrastructure component used by all other components
- **Dependencies**: Node.js fs module only
- **Consumers**: All processing components (block-finder, distributor-detector, balance-fetcher, event-scanner, fee-calculator)

## Design Principles

1. **Type Safety First**: All methods work with typed interfaces, not raw JSON
2. **Fail-Fast**: Any I/O error or validation failure causes immediate termination
3. **Schema Validation**: Validate data structure before writing
4. **Clear Errors**: Include context, values, and actionable next steps in all errors

## File Structure

```
store/
├── block_numbers.json              # Master date->block mappings
├── distributors.json               # All discovered distributors with metadata
└── distributors/
    └── {address}/                  # Per-distributor data directory
        ├── balances.json           # Historical balances by date
        └── outflows.json           # Distribution events by date
```

## Data Schemas

### 1. Master Block Numbers (`store/block_numbers.json`)

Maps dates to the last block before midnight UTC.

```json
{
  "metadata": {
    "chain_id": 42170 // From provider.getNetwork().chainId
  },
  "blocks": {
    "2024-01-15": 12345678,
    "2024-01-16": 12356789
  }
}
```

### 2. Distributors List (`store/distributors.json`)

Tracks all discovered distributors with their metadata.

```json
{
  "metadata": {
    "chain_id": 42170, // From provider.getNetwork().chainId
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
    },
    "0x1234567890123456789012345678901234567890": {
      "type": "L2_SURPLUS_FEE",
      "discovered_block": 15678901,
      "discovered_date": "2024-06-01",
      "tx_hash": "0xdef456...",
      "method": "0x2d9125e9",
      "owner": "0x0000000000000000000000000000000000000070",
      "event_data": "0x0000000000000000000000001234567890123456789012345678901234567890"
    }
  }
}
```

**Distributor Types:**

- `L2_BASE_FEE` - Created via method `0xee95a824`
- `L2_SURPLUS_FEE` - Created via method `0x2d9125e9`
- `L1_SURPLUS_FEE` - Created via method `0x934be07d`
- `L1_BASE_FEE` - (Skipping detection for now, see OUTSTANDING.md)

### 3. Balances (`store/distributors/{address}/balances.json`)

End-of-day balance snapshots for a distributor.

```json
{
  "metadata": {
    "chain_id": 42170, // From provider.getNetwork().chainId
    "reward_distributor": "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"
  },
  "balances": {
    "2024-01-15": {
      "block_number": 12345678,
      "balance_wei": "1000000000000000000000"
    }
  }
}
```

### 4. Outflows (`store/distributors/{address}/outflows.json`)

Daily distribution events and totals.

```json
{
  "metadata": {
    "chain_id": 42170, // From provider.getNetwork().chainId
    "reward_distributor": "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"
  },
  "outflows": {
    "2024-01-15": {
      "block_number": 12345678,
      "total_outflow_wei": "4000000000000000000000",
      "events": [
        {
          "recipient": "0xAAA...",
          "value_wei": "1500000000000000000000",
          "tx_hash": "0xdef..."
        }
      ]
    }
  }
}
```

**Note:** Wei values (balances and outflows) must be stored as decimal strings to prevent precision loss. Block numbers can be stored as regular numbers.

## Public API

### Core Methods

#### readBlockNumbers()

```typescript
readBlockNumbers(): BlockNumberData
```

- Returns the master block number mappings
- Creates empty structure if file doesn't exist
- Validates data structure on read

#### writeBlockNumbers(data: BlockNumberData)

```typescript
writeBlockNumbers(data: BlockNumberData): void
```

- Updates the master block number file
- Validates all dates are properly formatted (YYYY-MM-DD)
- Ensures block numbers are positive integers

#### readDistributors()

```typescript
readDistributors(): DistributorsData
```

- Returns all discovered distributors with metadata
- Creates empty structure if file doesn't exist
- Validates distributor addresses are checksummed

#### writeDistributors(data: DistributorsData)

```typescript
writeDistributors(data: DistributorsData): void
```

- Atomically updates the distributors list
- Validates all required fields are present
- Ensures distributor types are valid enum values

#### readDistributorBalances(address: string)

```typescript
readDistributorBalances(address: string): BalanceData
```

- Returns balance history for a specific distributor
- Creates empty structure if file doesn't exist
- Validates address format before reading

#### writeDistributorBalances(address: string, data: BalanceData)

```typescript
writeDistributorBalances(address: string, data: BalanceData): void
```

- Updates balance data for a distributor
- Creates distributor directory if needed
- Validates all balance values are valid decimal strings (no scientific notation)

#### readDistributorOutflows(address: string)

```typescript
readDistributorOutflows(address: string): OutflowData
```

- Returns outflow events for a specific distributor
- Creates empty structure if file doesn't exist
- Validates address format before reading

#### writeDistributorOutflows(address: string, data: OutflowData)

```typescript
writeDistributorOutflows(address: string, data: OutflowData): void
```

- Updates outflow data for a distributor
- Creates distributor directory if needed
- Validates event data matches expected schema
- Ensures all wei values are decimal strings

### Utility Methods

#### ensureStoreDirectory()

```typescript
ensureStoreDirectory(): void
```

- Creates the store directory if it doesn't exist
- Called automatically by write methods

#### validateAddress(address: string)

```typescript
validateAddress(address: string): string
```

- Validates and checksums Ethereum addresses using ethers.js `getAddress()`
- Returns properly checksummed address
- Throws descriptive error for invalid addresses

#### formatDate(date: Date)

```typescript
formatDate(date: Date): string
```

- Formats dates as YYYY-MM-DD in UTC
- Used for consistent date keys across the system

## Data Validation

### Schema Enforcement

- All write methods validate data against TypeScript interfaces
- Additional runtime checks for:
  - Valid Ethereum addresses (checksummed via ethers.js)
  - Positive block numbers (as regular numbers)
  - Non-negative wei values (as decimal strings, no scientific notation)
  - Valid date formats (YYYY-MM-DD)
  - Known distributor types
  - Wei values stored as decimal strings to prevent precision loss
  - Chain ID consistency across all files (when provided by components)

### Validation Errors

Include specific details about what failed:

```
Error: Invalid balance value in balances.json
  Date: 2024-01-15
  Value: -1000
  Expected: Non-negative decimal string
  File: store/distributors/0x.../balances.json
```

```
Error: Invalid numeric format in balances.json
  Date: 2024-01-16
  Value: 1.23e+21
  Expected: Decimal string (e.g., "1230000000000000000000")
  File: store/distributors/0x.../balances.json
```

## Error Handling

### File System Errors

#### File Not Found

- Read methods return empty typed structures (not errors)
- Allows components to start from clean state

#### Permission Denied

```
Error: Cannot write to block_numbers.json
  Path: /path/to/store/block_numbers.json
  Reason: Permission denied (EACCES)
  Fix: Check file permissions or run with appropriate user
```

#### Disk Full

```
Error: Failed to write distributors.json
  Path: /path/to/store/distributors.json
  Reason: No space left on device (ENOSPC)
  Fix: Free disk space and retry
```

### Data Errors

#### Invalid JSON

```
Error: Corrupted data in balances.json
  File: store/distributors/0x.../balances.json
  Line: 15, Column: 23
  Error: Unexpected token '}'
  Fix: Manually repair JSON or delete file to reset
```

#### Schema Violation

```
Error: Missing required field in distributor data
  Address: 0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9
  Missing: discovered_date
  Fix: Ensure all distributor entries have required fields
```

## Implementation Details

### Synchronous Writes

- Use `fs.writeFileSync()` for all write operations
- Always use `JSON.stringify(data, null, 2)` for human readability
- No temporary files or atomic rename operations needed

### Directory Creation

- Create parent directories recursively when needed
- Handle race conditions when multiple components start simultaneously

### File Locking

- Not required due to single-process execution model
- If parallel execution needed later, implement with lockfiles

## Testing Requirements

All tests use real file system operations with temporary directories. No mocking.

### Functional Test Areas

The File Manager component should be tested in the following functional areas:

#### 1. Core File Operations

**Block Numbers Management**

- Reading and writing block number mappings
- Handling missing files (return empty structures)
- Preserving data integrity through read/write cycles
- Supporting incremental updates

**Distributors Registry**

- Managing the distributors list and metadata
- Preserving all fields during serialization
- Using addresses as object keys correctly

**Per-Distributor Data**

- Reading and writing balance histories
- Reading and writing outflow events
- Creating distributor directories automatically
- Supporting large datasets (365+ days)

#### 2. Data Type Handling

**Wei Values**

- Storing as decimal strings (no scientific notation)
- Preventing precision loss
- Handling zero and maximum uint256 values

**Block Numbers**

- Storing as regular numbers (not strings)
- Supporting large block numbers without overflow

**Dates**

- Enforcing YYYY-MM-DD format
- Validating actual calendar dates

#### 3. Validation Logic

**Address Validation**

- Checksumming addresses using ethers.js
- Rejecting invalid formats
- Providing clear error messages

**Schema Validation**

- Enforcing required fields
- Validating enum values (distributor types)
- Checking data types match interfaces

**Input Sanitization**

- Preventing negative values where inappropriate
- Ensuring proper string/number types
- Validating date formats

#### 4. Error Handling

**File System Errors**

- Handling missing files gracefully
- Managing permission issues
- Dealing with disk space problems

**Data Corruption**

- Detecting invalid JSON
- Providing helpful error messages with context
- Including file paths and line numbers

**Validation Failures**

- Showing what failed and why
- Suggesting fixes
- Including expected formats

#### 5. File System Management

**Directory Operations**

- Creating directories as needed
- Setting proper permissions (0755 for dirs, 0644 for files)
- Handling concurrent operations

**Atomic Operations**

- Preventing partial writes
- Maintaining data consistency
- Not corrupting existing files on failure

**JSON Formatting**

- Using 2-space indentation
- Maintaining human readability
- Consistent property ordering

## Security Considerations

### Address Validation

- All addresses must be checksummed using ethers.js `getAddress()`
- This ensures consistent capitalization across the system
- Reject any address that doesn't pass checksum validation

### File Permissions

- Create files with 0644 permissions (readable by all, writable by owner)
- Create directories with 0755 permissions

### Input Sanitization

- Validate dates match expected format (YYYY-MM-DD)
- Ensure wei values are decimal strings (no exponential notation)
- Reject wei values with decimal points (must be integers)
