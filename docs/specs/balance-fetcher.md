# Balance Fetcher Technical Specification

## 1. Overview

The Balance Fetcher is a critical component in the AEP Fee Calculator system that retrieves and stores historical balance information for reward distributors on the Arbitrum Nova network. It queries blockchain state at specific end-of-day blocks to capture point-in-time balance snapshots necessary for accurate fee calculations.

## 2. Purpose

### Primary Objectives

- Retrieve end-of-day ETH balances for all tracked reward distributors
- Store historical balance data in a consistent, accessible format using FileManager
- Support incremental processing to handle new dates efficiently
- Handle distributors created mid-period by only fetching balances from their creation date onward
- Fetch balance at the distributor creation time as well

### Component Responsibilities

- Query blockchain state using RPC calls to retrieve balances
- Manage balance data persistence for each distributor
- Ensure data integrity and handle RPC failures gracefully
- Maintain idempotent operations for reliability

### Success Criteria

- All tracked distributors have balance data for all applicable dates
- Balance data accurately reflects on-chain state at specified blocks
- Component can process new dates incrementally without reprocessing existing data
- Balance fetching respects distributor creation dates (no queries before creation)

## 3. Dependencies

### External Libraries

- `ethers` (v6.x) - For RPC communication and blockchain interaction
- Node.js built-in modules: `fs/promises`, `path`

### System Components

- **FileManager**: For reading and writing balance data files
- **RPC Provider**: Arbitrum Nova RPC endpoint for blockchain queries

### Infrastructure Requirements

- Reliable RPC endpoint with support for `eth_getBalance` at historical blocks
- File system access for reading distributor list and block numbers
- Write permissions for storing balance data

## 4. Data Flow

### Input Flow

All input data is read through the FileManager component:

1. Use FileManager to read distributor addresses from storage
2. For each distributor:
   - Use FileManager to read master block numbers
   - Use FileManager to load existing balance data (if exists)
   - Determine which dates need balance queries

### Process Flow

1. Initialize RPC provider connection
2. For each distributor address:
   - Load distributor metadata to get creation date
   - Filter block numbers to only include dates from creation onward
   - For each applicable date without existing balance data:
     - Query balance using `eth_getBalance(address, blockNumber)`
     - Store result in memory
   - Write updated balance data to distributor's balance file

### Output Flow

- Balance data written using FileManager to distributor's balance file
- Each file contains complete balance history for that distributor
- FileManager handles atomic file updates internally

## 5. Public API

### Main Entry Point

```typescript
interface BalanceFetcher {
  fetchBalances(distributorAddress?: string): Promise<void>;
}
```

### Method Signatures

```typescript
fetchBalances(distributorAddress?: string): Promise<void>
```

- **Purpose**: Fetch balances for all distributors or a specific distributor at all tracked dates
- **Parameters**:
  - `distributorAddress` (optional): If provided, only fetch balances for this specific distributor
- **Returns**: Promise that resolves when all balances are fetched successfully
- **Behavior**:
  - Reads distributor list and block numbers using FileManager
  - If distributorAddress is provided, filters to only process that distributor
  - Fetches missing balances for each distributor to be processed
  - Throws error on any failure
  - Completes successfully only when all balances are fetched

## 6. Algorithm Details

### Balance Fetching Process

1. **Initialize**: Create RPC provider connection and file manager instance
2. **Load Distributors**: Read distributor list from storage
3. **Filter Distributors**: If distributorAddress parameter is provided, filter to only that distributor
4. **For Each Distributor**:
   - Load distributor metadata to get creation date
   - Load existing balance data (if any)
   - Load master block numbers list
   - Filter blocks to only include dates >= creation date
   - Add distributor creation block/date if not already present
   - Identify missing balance entries
   - For each missing date (including creation date):
     - Call `eth_getBalance` with distributor address and block number
     - Convert balance from hex to decimal string
     - Store in balance map
   - Merge new balances with existing data
   - Write updated balance file using FileManager

### Error Handling

- RPC failures trigger exponential backoff retry (up to 3 attempts)
- After retry exhaustion, errors are thrown (not logged and swallowed)
- Any distributor failure causes the entire process to fail
- FileManager ensures atomic updates - partial data is never written

## 7. Data Structures

### Input Types

```typescript
interface DistributorInfo {
  address: string;
  metadata: {
    name: string;
    created_at: string; // ISO date when distributor was created
  };
}

interface BlockNumbers {
  [date: string]: number; // Map of ISO date to block number
}
```

### Output Types

```typescript
interface BalanceData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  balances: {
    [date: string]: {
      block_number: number;
      balance_wei: string; // Decimal string to avoid precision loss
    };
  };
}
```

### RPC Response Types

```typescript
interface EthBalanceResponse {
  result: string; // Hex-encoded balance
}
```

## 8. Implementation Requirements

### Validation Rules

1. **Address Validation**:

   - All distributor addresses must be valid Ethereum addresses (checksum optional)
   - Addresses normalized to checksummed format before queries

2. **Date Validation**:

   - Dates must be in ISO format (YYYY-MM-DD)
   - Cannot query dates before distributor creation
   - Cannot query future dates

3. **Block Validation**:
   - Block numbers must be positive integers
   - Blocks must be at least 1000 blocks old (reorg protection)

### Security Considerations

1. **RPC Security**:

   - Use HTTPS endpoints only
   - Handle RPC errors without exposing sensitive information

2. **Data Integrity**:
   - FileManager ensures atomic file writes to prevent corruption
   - Validate all RPC responses before storage

## 9. Test Data Requirements

### Minimum Test Data

1. **Distributor List**: Use actual reward distributors from `__tests__/test-data/distributor-detector/distributor-creation-events-raw.json`
2. **Block Numbers**: Available in `__tests__/test-data/distributor-detector/block_numbers.json` with 9 dates spanning from 2022-07-11 to 2023-03-17
3. **RPC Responses**: Make actual RPC calls to Arbitrum Nova (no mocking)
4. **Edge Cases**:
   - Distributor created mid-period
   - Zero balance distributor
   - Large balance distributor (testing decimal string handling)

### Data Sources

Test data is available in the `__tests__/test-data` directory:

- Distributor addresses extracted from actual Arbitrum Nova events
- Real block numbers for test dates already available
- Balance values fetched from actual blockchain state

## 10. Examples

### Basic Usage

```typescript
const fetcher = new BalanceFetcher(fileManager, rpcProvider);

// Fetch balances for all distributors
await fetcher.fetchBalances();

// Fetch balances for a specific distributor
await fetcher.fetchBalances("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
```

### Sample Input/Output

**Input Files:**

- `store/distributors.json`: List of 2 distributors
- `store/block_numbers.json`: 5 dates with corresponding blocks

**Output File** (`store/distributors/0x123.../balances.json`):

```json
{
  "metadata": {
    "chain_id": 42170,
    "reward_distributor": "0x1234567890123456789012345678901234567890"
  },
  "balances": {
    "2024-01-15": {
      "block_number": 12345678,
      "balance_wei": "1500000000000000000000"
    },
    "2024-01-16": {
      "block_number": 12355678,
      "balance_wei": "1480000000000000000000"
    }
  }
}
```

## 11. Out of Scope

The following features are explicitly NOT part of this component:

### Performance Optimizations

- Parallel RPC requests across distributors
- Caching of RPC responses
- Batch balance queries
- Connection pooling for RPC providers

### Additional Features

- Balance change notifications or alerts
- Historical balance analytics or trends
- Balance prediction or estimation
- Support for non-ETH token balances
- Direct database storage (only file-based storage)
- Real-time balance monitoring
- Balance reconciliation with events

### Error Recovery

- Automatic retry scheduling for failed fetches
- Dead letter queue for persistent failures
- Manual intervention tooling

### User Interface

- Progress visualization
- Interactive balance queries
- Web dashboard or API endpoints

These features may be valuable but should be implemented in separate components or future iterations to maintain focus and simplicity.
