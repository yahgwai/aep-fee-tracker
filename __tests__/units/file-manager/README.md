# FileManager Test Suite

This directory contains the organized test suite for the FileManager class, which handles all file I/O operations for the eth-fee-tracker project.

## Test Organization

The tests have been separated into logical groups based on functionality:

### Core Tests

- **core-structure.test.ts** - Tests for basic FileManager functionality:
  - Constructor and instance creation
  - `ensureStoreDirectory()` - Directory creation and management
  - `formatDate()` - Date formatting utilities
  - `validateAddress()` - Ethereum address validation and checksumming

### Data Type Tests

- **block-numbers.test.ts** - Tests for block number data management:

  - `readBlockNumbers()` and `writeBlockNumbers()`
  - Date format validation
  - Block number range validation
  - JSON formatting

- **distributors.test.ts** - Tests for distributor registry management:

  - `readDistributors()` and `writeDistributors()`
  - Address checksumming validation
  - Distributor type enum validation
  - Required field validation

- **distributor-balances.test.ts** - Tests for distributor balance tracking:

  - `readDistributorBalances()` and `writeDistributorBalances()`
  - Wei value validation (no scientific notation, no decimals)
  - Large number handling (uint256 max values)
  - Historical balance tracking

- **distributor-outflows.test.ts** - Tests for distributor outflow tracking:
  - `readDistributorOutflows()` and `writeDistributorOutflows()`
  - Transaction hash validation
  - Event aggregation and total validation
  - Multiple events per day handling

### Utility Tests

- **validation-helpers.test.ts** - Tests for internal validation methods:
  - `validateDateFormat()` - Date string validation
  - `validateBlockNumber()` - Block number validation
  - `validateWeiValue()` - Wei amount validation
  - `validateTransactionHash()` - Transaction hash validation
  - `validateEnumValue()` - Enum value validation

### Index File

- **index.test.ts** - Imports all test suites for easy bulk testing

## Running Tests

To run all FileManager tests:

```bash
npm test -- __tests__/units/file-manager/
```

To run a specific test file:

```bash
npm test -- __tests__/units/file-manager/core-structure.test.ts
```

## Test Coverage

The test suite provides comprehensive coverage of:

- All public methods of the FileManager class
- All validation logic and error cases
- Edge cases like maximum uint256 values
- Concurrent operations and race conditions
- File system operations and error handling
