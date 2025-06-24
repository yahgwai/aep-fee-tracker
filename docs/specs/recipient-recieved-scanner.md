# RecipientRecieved Scanner Component Technical Specification

## 1. Overview

The RecipientRecieved Scanner is a critical component in the fee calculation pipeline that collects and stores token distribution events from reward distributor contracts on the blockchain. This component bridges the gap between on-chain activity and off-chain analytics by systematically scanning blockchain events and transforming them into structured event data.

The component fits into the data processing pipeline after the Balance Fetcher and before the Fee Calculator, providing essential distribution data that enables accurate fee calculations based on actual token distributions.

## 2. Purpose

### Primary Objectives

- Scan blockchain for `RecipientRecieved` events from known reward distributor contracts
- Store all collected events for each distributor
- Maintain incremental processing state to support efficient updates
- Provide accurate, validated data for downstream fee calculations

### Component Responsibilities

- Read distributor addresses and creation dates from persistent storage
- Query blockchain events within specified date ranges
- Parse and validate event data
- Store events organized by date
- Persist event data in the required format
- Handle incremental updates without data duplication

### Success Criteria

- All `RecipientRecieved` events are captured for each distributor from creation date onward
- All events are stored with their original values and transaction details
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

## 4. Data Flow

### Input Flow

1. Read distributor list from FileManager
2. For each distributor:
   - Read creation date from distributor data
   - Read master block numbers from FileManager
   - Determine date ranges to process (from creation date to latest available)

### Process Flow

1. For each processing date:
   - Calculate block range (previous day's block + 1 to current day's block)
   - Query blockchain for `RecipientRecieved` events using chunkBlockRange utility
   - For each event:
     - Store raw event data
     - Parse recipient and value using ethers interface
     - Store event keyed by transactionHash:logIndex

### Output Flow

1. Write/update outflow data for each distributor through FileManager
2. Output contains complete event history from creation to latest processed date

### Integration Points

- **Upstream**: Depends on Distributor Detector output and Block Number data
- **Downstream**: Fee Calculator consumes outflow data for fee calculations

## 5. Public API

### Interface Definition

```typescript
interface RecipientRecievedScanner {
  /**
   * Scans for RecipientRecieved events and updates outflow data
   * @param distributorAddress - Optional distributor address. If provided, scans only that distributor. If omitted, scans all distributors
   * @returns Promise that resolves when scanning is complete
   * @throws Error if critical failures occur (file access, RPC connection, distributor not found)
   */
  scan(distributorAddress?: string): Promise<void>;
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
   - Load master block numbers for date mapping (once for all distributors)
   - For each distributor, execute single distributor scan
   - Continue processing even if individual distributors fail
   - Report summary of successes and failures

3. **Scan Single Distributor**

   - Load distributor metadata (address, creation date, chain ID)
   - Load existing outflow data or initialize empty structure
   - Determine unprocessed date ranges
   - For each date:
     - Calculate block range for the date
     - Query events using block range
     - For each event:
       - Parse recipient and value using ethers interface
       - Store event with raw and parsed data
       - Key by transactionHash:logIndex
   - Update last_scanned_block in metadata
   - Persist updated event data

4. **Query Events**

   - Construct filter for `RecipientRecieved` event signature
   - Use block chunking for large ranges (10,000 blocks per chunk)
   - Apply retry logic with exponential backoff
   - Handle rate limiting gracefully

5. **Parse Events**
   - Use ethers interface to decode event data
   - Extract recipient address from decoded event
   - Extract value from decoded event
   - Store both raw event data and parsed fields
   - Create unique key using transactionHash:logIndex

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
interface RecipientRecievedEvent {
  // Raw event data
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  address: string; // Contract address that emitted the event
  topics: string[]; // Raw event topics
  data: string; // Raw event data

  // Parsed fields
  recipient: string; // Checksummed recipient address
  value: string; // Decimal string representation of value
}

interface RecipientRecievedEventData {
  metadata: {
    chain_id: number; // Network chain ID
    reward_distributor: string; // Distributor contract address
    last_scanned_block: number; // Last block that was successfully scanned
  };
  events: {
    [key: string]: RecipientRecievedEvent; // Key format: "transactionHash:logIndex"
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

### Security Considerations

1. **Data Integrity**

   - Use checksummed addresses for consistency

2. **Error Handling**

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

- Nova Arbitrum reward distributor contracts (already available in test files)
- Historical blockchain data via standard RPC (same as used in other tests)
- Test fixtures for edge cases

**Note**: A ticket is needed to collect all Nova RecipientRecieved events. This should involve creating a one-off script to scan through all blocks looking for these events from the known distributors.

**Note**: A ticket is also needed to update the FileManager implementation and specification to support the new RecipientRecievedEventData structure for storing raw event data.

### Expected Test Data Format

The collected test data should be stored as JSON files with the following structure:

```json
{
  "chain_id": 42170,
  "distributor_address": "0x...",
  "events": [
    {
      "blockNumber": 12345678,
      "transactionHash": "0x...",
      "logIndex": 0,
      "address": "0x...",
      "topics": ["0x...", "0x..."],
      "data": "0x...",
      "recipient": "0x...",
      "value": "1000000000000000000"
    }
  ]
}
```

## 10. Examples

### Basic Usage

```typescript
// Initialize components
const provider = new ethers.JsonRpcProvider(RPC_URL);
const fileManager = new FileManager();
const scanner = new RecipientRecievedScanner(provider, fileManager);

// Scan all distributors
await scanner.scan();

// Or scan a specific distributor
await scanner.scan("0x1234567890123456789012345678901234567890");
```

### Sample Input

Distributor data from FileManager:

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

Outflow data written through FileManager:

```json
{
  "metadata": {
    "chain_id": 42161,
    "reward_distributor": "0x1234567890123456789012345678901234567890",
    "last_scanned_block": 100123456
  },
  "events": {
    "0x9876543210987654321098765432109876543210987654321098765432109876:0": {
      "blockNumber": 100123456,
      "transactionHash": "0x9876543210987654321098765432109876543210987654321098765432109876",
      "logIndex": 0,
      "address": "0x1234567890123456789012345678901234567890",
      "topics": [
        "0x...",
        "0x000000000000000000000000abcdef0123456789012345678901234567890123"
      ],
      "data": "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
      "recipient": "0xAbCdEf0123456789012345678901234567890123",
      "value": "1000000000000000000"
    },
    "0x1234567890123456789012345678901234567890123456789012345678901234:1": {
      "blockNumber": 100123456,
      "transactionHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
      "logIndex": 1,
      "address": "0x1234567890123456789012345678901234567890",
      "topics": [
        "0x...",
        "0x000000000000000000000000fedcba0123456789012345678901234567890123"
      ],
      "data": "0x00000000000000000000000000000000000000000000000006f05b59d3b20000",
      "recipient": "0xFeDcBa0123456789012345678901234567890123",
      "value": "500000000000000000"
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

Remember: This component's sole responsibility is to accurately collect and store `RecipientRecieved` events into the required data structure for fee calculation. Keep it simple, reliable, and focused on this single purpose.
