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
    "chain_id": 42161
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
    "chain_id": 42161,
    "arbowner_address": "0x0000000000000000000000000000000000000070"
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
    "chain_id": 42161,
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
    "chain_id": 42161,
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
readBlockNumbers(): Promise<BlockNumberData>
```
- Returns the master block number mappings
- Creates empty structure if file doesn't exist
- Validates data structure on read

#### writeBlockNumbers(data: BlockNumberData)
```typescript
writeBlockNumbers(data: BlockNumberData): Promise<void>
```
- Updates the master block number file
- Validates all dates are properly formatted (YYYY-MM-DD)
- Ensures block numbers are positive integers

#### readDistributors()
```typescript
readDistributors(): Promise<DistributorsData>
```
- Returns all discovered distributors with metadata
- Creates empty structure if file doesn't exist
- Validates distributor addresses are checksummed

#### writeDistributors(data: DistributorsData)
```typescript
writeDistributors(data: DistributorsData): Promise<void>
```
- Atomically updates the distributors list
- Validates all required fields are present
- Ensures distributor types are valid enum values

#### readDistributorBalances(address: string)
```typescript
readDistributorBalances(address: string): Promise<BalanceData>
```
- Returns balance history for a specific distributor
- Creates empty structure if file doesn't exist
- Validates address format before reading

#### writeDistributorBalances(address: string, data: BalanceData)
```typescript
writeDistributorBalances(address: string, data: BalanceData): Promise<void>
```
- Updates balance data for a distributor
- Creates distributor directory if needed
- Validates all balance values are valid decimal strings (no scientific notation)

#### readDistributorOutflows(address: string)
```typescript
readDistributorOutflows(address: string): Promise<OutflowData>
```
- Returns outflow events for a specific distributor
- Creates empty structure if file doesn't exist
- Validates address format before reading

#### writeDistributorOutflows(address: string, data: OutflowData)
```typescript
writeDistributorOutflows(address: string, data: OutflowData): Promise<void>
```
- Updates outflow data for a distributor
- Creates distributor directory if needed
- Validates event data matches expected schema
- Ensures all wei values are decimal strings

### Utility Methods

#### ensureStoreDirectory()
```typescript
ensureStoreDirectory(): Promise<void>
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

### Test Cases

#### 1. Block Numbers - Read/Write Operations

- `should return empty BlockNumberData when block_numbers.json does not exist` - Reads missing file and returns proper empty structure with metadata
- `should write and read back BlockNumberData with multiple date entries` - Writes complete block data and verifies exact match on read
- `should preserve block number precision for large block numbers` - Tests with block numbers like 200000000+ to ensure no precision loss
- `should format JSON with 2-space indentation for human readability` - Verifies output file has proper pretty-printing
- `should maintain date ordering in blocks object` - Ensures dates remain in chronological order after write/read cycle
- `should handle single date entry correctly` - Tests edge case of just one date-block mapping

#### 2. Distributors - Read/Write Operations

- `should return empty DistributorsData when distributors.json does not exist` - Reads missing file and returns proper empty structure with metadata
- `should write and read back DistributorsData with multiple distributors` - Tests with 5+ distributors of different types
- `should preserve all distributor metadata fields` - Verifies no fields are lost in serialization (tx_hash, event_data, etc.)
- `should maintain distributor addresses as object keys` - Ensures addresses used as keys are preserved exactly
- `should handle distributors with very long event_data hex strings` - Tests with actual mainnet event data lengths

#### 3. Balance Data - Read/Write Operations

- `should return empty BalanceData when balances.json does not exist` - Returns proper structure with metadata for missing file
- `should create distributor directory when writing balances for new address` - Verifies directory creation happens automatically
- `should write and read back BalanceData with many dates` - Tests with 365+ daily balance entries
- `should preserve wei values as strings without modification` - Ensures "1000000000000000000000" stays exactly as string
- `should handle balance of 0 correctly` - Tests edge case of "0" balance storage and retrieval
- `should update existing balance file with new dates` - Tests incremental updates to existing balance data

#### 4. Outflow Data - Read/Write Operations

- `should return empty OutflowData when outflows.json does not exist` - Returns proper structure with metadata for missing file
- `should create distributor directory when writing outflows for new address` - Verifies directory creation for new distributor
- `should write and read back OutflowData with multiple events per day` - Tests days with 10+ distribution events
- `should preserve event order within daily arrays` - Ensures events maintain their array order
- `should handle days with no events (empty events array)` - Tests edge case of days with total_outflow_wei "0" and empty events
- `should calculate and store total_outflow_wei correctly` - Verifies sum of event values matches total

#### 5. Address Validation

- `should checksum lowercase addresses before storing` - Converts "0xabc..." to properly checksummed "0xAbC..."
- `should accept already checksummed addresses` - Passes through correctly formatted addresses unchanged
- `should reject addresses shorter than 42 characters` - Throws ValidationError with clear message
- `should reject addresses longer than 42 characters` - Throws ValidationError with clear message
- `should reject addresses with invalid characters` - Rejects addresses containing non-hex characters
- `should reject addresses that don't start with 0x` - Ensures proper Ethereum address format
- `should provide specific error for invalid checksum` - Clear error when address has wrong capitalization

#### 6. Date Validation

- `should accept valid YYYY-MM-DD format dates` - Validates dates like "2024-01-15" pass validation
- `should reject dates with invalid format (MM/DD/YYYY)` - Throws error for American date format
- `should reject dates with invalid format (DD-MM-YYYY)` - Throws error for European date format
- `should reject dates with single digit months` - Rejects "2024-1-15" in favor of "2024-01-15"
- `should reject dates with single digit days` - Rejects "2024-01-5" in favor of "2024-01-05"
- `should reject invalid dates like February 30` - Validates actual calendar dates
- `should handle leap year dates correctly` - Accepts "2024-02-29" but rejects "2023-02-29"

#### 7. Wei Value Validation

- `should accept valid decimal string wei values` - Validates strings like "1000000000000000000000"
- `should reject numeric wei values (not strings)` - Throws error if number type passed instead of string
- `should reject wei values in scientific notation` - Rejects "1.23e+21" format with clear error
- `should reject negative wei values` - Throws error for "-1000" with appropriate message
- `should reject wei values with decimal points` - Rejects "1000.5" as wei must be integers
- `should accept zero as valid wei value "0"` - Ensures "0" is valid wei string
- `should handle maximum uint256 wei values` - Tests with "115792089237316195423570985008687907853269984665640564039457584007913129639935"

#### 8. Block Number Validation

- `should accept positive integer block numbers` - Validates numbers like 12345678
- `should reject negative block numbers` - Throws error for block number -1
- `should reject zero as block number` - Throws error as block 0 is genesis (no previous block)
- `should reject non-integer block numbers` - Throws error for 12345.67
- `should reject string block numbers` - Ensures block numbers are stored as numbers, not strings
- `should handle very large block numbers` - Tests with block numbers up to 999999999

#### 9. Distributor Type Validation

- `should accept valid L2_BASE_FEE distributor type` - Validates enum value properly
- `should accept valid L2_SURPLUS_FEE distributor type` - Validates enum value properly
- `should accept valid L1_SURPLUS_FEE distributor type` - Validates enum value properly
- `should reject invalid distributor type "UNKNOWN"` - Throws error with list of valid types
- `should reject lowercase distributor types` - Ensures exact enum match (case sensitive)
- `should provide helpful error listing all valid types` - Error message includes all valid options

#### 10. Directory Creation

- `should create store directory if it does not exist` - Tests ensureStoreDirectory() creates base directory
- `should create nested distributor directory on first write` - Creates store/distributors/0xABC.../ path
- `should handle concurrent directory creation gracefully` - Multiple writes don't cause race condition errors
- `should not error if directory already exists` - Idempotent directory creation
- `should create directories with 0755 permissions` - Verifies correct directory permissions
- `should create files with 0644 permissions` - Verifies correct file permissions

#### 11. Error Messages

- `should include file path in file system errors` - Error shows exact path that failed
- `should include field name and value in validation errors` - Shows what field failed and why
- `should suggest fixes for common errors` - Includes actionable next steps
- `should differentiate between corruption and missing files` - Clear different messages for each case
- `should include line and column for JSON parse errors` - Points to exact location of syntax error
- `should show expected format for validation failures` - Shows example of correct format

#### 12. Atomic Write Operations

- `should not leave partial files on write failure` - File doesn't exist if write fails midway
- `should not corrupt existing file if update fails` - Original file unchanged on failed update
- `should write complete file in single operation` - No incremental writing that could fail partially
- `should handle disk full errors gracefully` - Appropriate error without partial data
- `should handle permission denied errors clearly` - Specific error about permissions

#### 13. JSON Formatting

- `should write JSON with 2-space indentation` - Human readable formatting verified
- `should write each object property on new line` - No minified JSON output
- `should write arrays with proper indentation` - Array elements properly indented
- `should not include trailing commas` - Valid JSON without trailing commas
- `should use consistent property ordering` - Metadata always before data sections

#### 14. Integration Tests

- `should handle full lifecycle of new distributor` - Discovery, balance fetch, outflow recording, all files created
- `should support incremental daily updates` - Add new dates to existing files without losing data
- `should maintain consistency across all files` - Same distributor appears correctly in all relevant files
- `should handle 1000+ distributors without performance issues` - Tests scalability of file operations
- `should work with actual mainnet data examples` - Tests with real addresses and values from Arbitrum



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

