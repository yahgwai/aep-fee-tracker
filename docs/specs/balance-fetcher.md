# Balance Fetcher Technical Specification

## 1. Overview

The Balance Fetcher is a critical component in the AEP Fee Calculator system that retrieves and stores historical balance information for reward distributors on the Arbitrum Nova network. It queries blockchain state at specific end-of-day blocks to capture point-in-time balance snapshots necessary for accurate fee calculations.

## 2. Purpose

### Primary Objectives

- Retrieve end-of-day ETH balances for all tracked reward distributors
- Store historical balance data in a consistent, accessible format
- Support incremental processing to handle new dates efficiently
- Handle distributors created mid-period by only fetching balances from their creation date onward

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

1. Read distributor addresses from `store/distributors.json`
2. For each distributor:
   - Read master block numbers from `store/block_numbers.json`
   - Load existing balance data from `store/distributors/{address}/balances.json` (if exists)
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

- Balance data written to `store/distributors/{address}/balances.json`
- Each file contains complete balance history for that distributor
- File updates are atomic (write to temp file, then rename)

## 5. Public API

### Main Entry Point

```typescript
interface BalanceFetcher {
  fetchBalances(options?: FetchOptions): Promise<FetchResult>;
}
```

### Method Signatures

```typescript
fetchBalances(options?: FetchOptions): Promise<FetchResult>
```

- **Purpose**: Fetch balances for all distributors at all tracked dates
- **Parameters**: Optional configuration for controlling fetch behavior
- **Returns**: Summary of fetch operation including success/failure counts
- **Behavior**:
  - Reads distributor list and block numbers
  - Fetches missing balances for each distributor
  - Handles partial failures gracefully
  - Returns comprehensive result summary

## 6. Algorithm Details

### Balance Fetching Process

1. **Initialize**: Create RPC provider connection and file manager instance
2. **Load Distributors**: Read distributor list from storage
3. **For Each Distributor**:
   - Load distributor metadata to get creation date
   - Load existing balance data (if any)
   - Load master block numbers list
   - Filter blocks to only include dates >= creation date
   - Identify missing balance entries
   - For each missing date:
     - Call `eth_getBalance` with distributor address and block number
     - Convert balance from hex to decimal string
     - Store in balance map
   - Merge new balances with existing data
   - Write updated balance file atomically

### Error Handling

- RPC failures trigger exponential backoff retry (up to 3 attempts)
- Individual distributor failures don't stop processing of others
- Failed fetches are logged and reported in result summary
- Partial data is never written - updates are atomic

## 7. Data Structures

### Input Types

```typescript
interface FetchOptions {
  distributors?: string[]; // Optional list of specific distributors to process
  dates?: string[]; // Optional list of specific dates to process
  forceRefresh?: boolean; // Force re-fetch even if data exists
}

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
interface FetchResult {
  success: boolean;
  distributorsProcessed: number;
  balancesFetched: number;
  errors: FetchError[];
}

interface FetchError {
  distributor: string;
  date: string;
  error: string;
}

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
   - Implement request rate limiting
   - Handle RPC errors without exposing sensitive information

2. **Data Integrity**:
   - Atomic file writes to prevent corruption
   - Validate all RPC responses before storage
   - Maintain backup of existing data before updates

## 9. Test Data Requirements

### Minimum Test Data

1. **Distributor List**: At least 3 distributor addresses with different creation dates
2. **Block Numbers**: At least 7 days of block numbers spanning distributor lifetimes
3. **RPC Responses**: Mock responses for `eth_getBalance` calls
4. **Edge Cases**:
   - Distributor created mid-period
   - Zero balance distributor
   - Large balance distributor (testing decimal string handling)

### Data Sources

- Use actual Arbitrum Nova distributor addresses from production
- Query real block numbers for test dates
- Generate realistic balance values based on actual distributor behavior

## 10. Examples

### Basic Usage

```typescript
const fetcher = new BalanceFetcher(fileManager, rpcProvider);
const result = await fetcher.fetchBalances();

console.log(`Processed ${result.distributorsProcessed} distributors`);
console.log(`Fetched ${result.balancesFetched} new balances`);
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
