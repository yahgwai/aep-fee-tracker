# Event Scanner Component Technical Specification

## 1. Overview

The Event Scanner is a critical component in the fee calculation pipeline that collects and aggregates token distribution events from reward distributor contracts on the blockchain. This component bridges the gap between on-chain activity and off-chain analytics by systematically scanning blockchain events and transforming them into structured outflow data.

The component fits into the data processing pipeline after the Balance Fetcher and before the Fee Calculator, providing essential outflow data that enables accurate fee calculations based on actual token distributions.

## 2. Purpose

### Primary Objectives

- Scan blockchain for `RecipientRecieved` events from known reward distributor contracts
- Aggregate daily outflow data for each distributor
- Maintain incremental processing state to support efficient updates
- Provide accurate, validated data for downstream fee calculations

### Component Responsibilities

- Read distributor addresses and creation dates from persistent storage
- Query blockchain events within specified date ranges
- Parse and validate event data
- Calculate daily outflow totals
- Persist outflow data in the required format
- Handle incremental updates without data duplication

### Success Criteria

- All `RecipientRecieved` events are captured for each distributor from creation date onward
- Daily outflow totals match the sum of all events for that day
- Incremental processing correctly handles interrupted scans
- Output files conform to the expected schema and validation rules
- Component integrates seamlessly with existing file-based data flow

## 3. Dependencies

### External Libraries

- `ethers` (v6): Blockchain interaction and event parsing
- Node.js built-in modules: `fs/promises`, `path`

### System Components

- `FileManager`: Handles all file I/O operations
- `withRetry` utility: Provides retry logic for RPC calls
- `chunkBlockRange` utility: Splits large block ranges for efficient querying

### Infrastructure Requirements

- Access to an Ethereum-compatible JSON-RPC provider
- Read/write access to the `store/` directory structure
- Sufficient memory to process event batches (estimated <100MB per day)

## 4. Data Flow

### Input Flow

1. Read distributor list from `store/distributors.json`
2. For each distributor:
   - Read creation date from distributor data
   - Read master block numbers from `store/block_numbers.json`
   - Determine date ranges to process (from creation date to latest available)

### Process Flow

1. For each processing date:
   - Calculate block range (previous day's block + 1 to current day's block)
   - Query blockchain for `RecipientRecieved` events in range
   - Parse event data and extract recipient, value, and transaction hash
   - Aggregate events and calculate total outflow
   - Update or create outflow data structure

### Output Flow

1. Write/update `store/distributors/{address}/outflows.json` for each distributor
2. File contains complete outflow history from creation to latest processed date

### Integration Points

- **Upstream**: Depends on Distributor Detector output and Block Number data
- **Downstream**: Fee Calculator consumes outflow data for fee calculations

## 5. Public API

### Interface Definition

```typescript
interface EventScanner {
  /**
   * Scans all distributors for RecipientRecieved events and updates outflow data
   * @returns Promise that resolves when all distributors are processed
   * @throws Error if critical failures occur (file access, RPC connection)
   */
  scanAll(): Promise<void>;

  /**
   * Scans a specific distributor for RecipientRecieved events
   * @param distributorAddress - The distributor contract address to scan
   * @returns Promise that resolves when distributor is processed
   * @throws Error if distributor not found or processing fails
   */
  scanDistributor(distributorAddress: string): Promise<void>;
}
```

### Constructor

```typescript
constructor(
  provider: ethers.Provider,
  fileManager: FileManager
)
```

## 6. Algorithm Details

### Core Logic

1. **Initialize Scanner**

   - Accept ethers provider and file manager instances
   - Validate provider connection and chain ID

2. **Scan All Distributors**

   - Load distributor list from storage
   - For each distributor, execute single distributor scan
   - Continue processing even if individual distributors fail
   - Report summary of successes and failures

3. **Scan Single Distributor**

   - Load distributor metadata (address, creation date, chain ID)
   - Load existing outflow data or initialize empty structure
   - Load master block numbers for date mapping
   - Determine unprocessed date ranges
   - For each date:
     - Calculate block range for the date
     - Query events using block range
     - Parse and validate each event
     - Aggregate daily totals
     - Update outflow data structure
   - Persist updated outflow data

4. **Query Events**

   - Construct filter for `RecipientRecieved` event signature
   - Use block chunking for large ranges (10,000 blocks per chunk)
   - Apply retry logic with exponential backoff
   - Handle rate limiting gracefully

5. **Parse Events**
   - Extract recipient address from event topics
   - Extract value from event data
   - Validate addresses and values
   - Build event record with transaction hash

## 7. Data Structures

### Input Types

```typescript
interface DistributorInfo {
  chain_id: number;
  reward_distributor: string;
  creation_block: number;
  creation_date: string; // YYYY-MM-DD format
}

interface DistributorList {
  distributors: DistributorInfo[];
}

interface BlockNumberEntry {
  block_number: number;
  timestamp: number;
}

interface BlockNumbers {
  [date: string]: BlockNumberEntry; // YYYY-MM-DD format
}
```

### Output Types

```typescript
interface OutflowEvent {
  recipient: string; // Checksummed Ethereum address
  value_wei: string; // Decimal string representation
  tx_hash: string; // 0x-prefixed transaction hash
}

interface DailyOutflow {
  block_number: number; // Last block of the day
  total_outflow_wei: string; // Sum of all event values
  events: OutflowEvent[]; // All events for the day
}

interface OutflowData {
  metadata: {
    chain_id: number; // Network chain ID
    reward_distributor: string; // Distributor contract address
  };
  outflows: {
    [date: string]: DailyOutflow; // YYYY-MM-DD format
  };
}
```

### Event Structure

```typescript
// RecipientRecieved event (note intentional misspelling)
// event RecipientRecieved(address indexed recipient, uint256 value)
interface RecipientRecievedEvent {
  topics: [string, string]; // [eventSignature, recipientAddress]
  data: string; // Encoded uint256 value
  transactionHash: string; // Transaction that emitted the event
  address: string; // Contract that emitted the event
}
```

## 8. Implementation Requirements

### Validation Rules

1. **Input Validation**

   - Distributor address must be valid Ethereum address
   - Distributor must exist in distributors.json
   - Block numbers file must contain required date ranges
   - Dates must be in YYYY-MM-DD format

2. **Event Validation**

   - Event must be from specified distributor contract
   - Recipient must be valid Ethereum address
   - Value must be valid uint256 (non-negative, within bounds)
   - Transaction hash must be 66 characters (0x + 64 hex)

3. **Output Validation**
   - Total outflow must equal sum of event values
   - All monetary values stored as decimal strings
   - Addresses stored in checksummed format
   - No duplicate events within a day

### Security Considerations

1. **Data Integrity**

   - Validate all blockchain data before processing
   - Use checksummed addresses for consistency
   - Atomic file updates (write to temp, then rename)

2. **Error Handling**

   - Never partially update outflow data
   - Preserve existing data on failure
   - Clear error messages with context

3. **Resource Management**
   - Process events in manageable batches
   - Limit concurrent RPC requests
   - Clean up resources on failure

## 9. Test Data Requirements

### Minimum Test Data

1. At least one deployed reward distributor contract
2. Historical `RecipientRecieved` events spanning multiple days
3. Master block numbers file covering all test dates
4. Various event patterns:
   - Single event days
   - Multiple event days
   - Days with no events
   - Large value transfers
   - Small value transfers

### Data Sources

- Mainnet Arbitrum reward distributor contracts
- Historical blockchain data via archive node
- Test fixtures for edge cases

## 10. Examples

### Basic Usage

```typescript
// Initialize components
const provider = new ethers.JsonRpcProvider(RPC_URL);
const fileManager = new FileManager("./store");
const scanner = new EventScanner(provider, fileManager);

// Scan all distributors
await scanner.scanAll();
```

### Sample Input

`store/distributors.json`:

```json
{
  "distributors": [
    {
      "chain_id": 42161,
      "reward_distributor": "0x1234567890123456789012345678901234567890",
      "creation_block": 100000000,
      "creation_date": "2024-01-15"
    }
  ]
}
```

### Expected Output

`store/distributors/0x1234567890123456789012345678901234567890/outflows.json`:

```json
{
  "metadata": {
    "chain_id": 42161,
    "reward_distributor": "0x1234567890123456789012345678901234567890"
  },
  "outflows": {
    "2024-01-15": {
      "block_number": 100123456,
      "total_outflow_wei": "1500000000000000000",
      "events": [
        {
          "recipient": "0xAbCdEf0123456789012345678901234567890123",
          "value_wei": "1000000000000000000",
          "tx_hash": "0x9876543210987654321098765432109876543210987654321098765432109876"
        },
        {
          "recipient": "0xFeDcBa0123456789012345678901234567890123",
          "value_wei": "500000000000000000",
          "tx_hash": "0x1234567890123456789012345678901234567890123456789012345678901234"
        }
      ]
    }
  }
}
```

## 11. Out of Scope

The following features are explicitly NOT part of this implementation:

### Performance Optimizations

- Parallel scanning of multiple distributors
- Event caching mechanisms
- Database storage (stick to file-based approach)
- WebSocket/subscription-based event monitoring

### Additional Features

- Real-time event monitoring
- Historical data backfilling beyond creation date
- Event filtering by recipient or value thresholds
- Cross-chain scanning (single chain per instance)
- Automatic distributor discovery
- Gas cost tracking
- Event timestamp enrichment (use block-based dates only)

### Analytics

- Statistical analysis of outflows
- Recipient ranking or categorization
- Trend analysis or predictions
- Value conversions to USD or other currencies

### User Interface

- Web dashboard or API endpoints
- Progress indicators beyond console output
- Interactive configuration
- Notification systems

Remember: This component's sole responsibility is to accurately collect and aggregate `RecipientRecieved` events into the required data structure for fee calculation. Keep it simple, reliable, and focused on this single purpose.
