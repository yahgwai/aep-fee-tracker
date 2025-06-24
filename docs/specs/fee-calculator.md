# Fee Calculator Technical Specification

## 1. Overview

The Fee Calculator is the final component in the AEP Fee Calculator pipeline that computes daily fee metrics for reward distributors on the Arbitrum Nova network. It analyzes balance changes and distribution events to determine how much each distributor collected in fees for each day, providing transparent fee tracking for the Arbitrum Expansion Program.

## 2. Purpose

### Primary Objectives

- Calculate daily fees for each tracked reward distributor
- Analyze balance changes and distribution events to determine fee collection
- Generate comprehensive fee reports showing daily breakdowns
- Support incremental processing for efficient updates

### Component Responsibilities

- Read distributor data, balances, and events through FileManager
- Compute daily fee amounts using balance changes and distributions
- Validate data consistency before calculations
- Output structured fee reports

### Success Criteria

- All distributors have accurate daily fee calculations for applicable dates
- Fee calculations correctly reflect the formula: Daily Fees = Balance Change + Distributions
- Component handles missing or incomplete data gracefully
- Reports clearly show fee breakdowns per distributor per day

## 3. Dependencies

### External Libraries

- Node.js built-in modules: `fs/promises`, `path`
- No external dependencies required

### System Components

- **FileManager**: Exclusive interface for all data access (distributors, balances, events)

### Infrastructure Requirements

- Read access to stored distributor, balance, and event data through FileManager
- Write permissions for fee calculation results

## 4. Data Flow

### Input Flow

All data access exclusively through FileManager functions:

1. Use FileManager to read list of all tracked distributors
2. For each distributor:
   - Use FileManager to read balance history data
   - Use FileManager to read distribution event data
3. Validate data completeness and consistency

### Process Flow

1. Load all distributor addresses from FileManager
2. For each distributor:
   - Retrieve complete balance history
   - Retrieve all distribution events
   - Sort data chronologically
   - For each day with balance data:
     - Calculate balance change from previous day
     - Sum distributions for that day
     - Compute daily fee = balance change + distributions
   - Store calculated fees in memory
3. Generate comprehensive fee report
4. Write results using FileManager

### Output Flow

- Fee calculation results written through FileManager
- Single report file containing all distributor daily fees
- Structured format supporting easy querying and analysis

## 5. Public API

### Main Entry Point

```typescript
interface FeeCalculator {
  calculateFees(distributorAddress?: string): Promise<void>;
}
```

### Method Signatures

```typescript
calculateFees(distributorAddress?: string): Promise<void>
```

- **Purpose**: Calculate daily fees for all distributors or a specific distributor
- **Parameters**:
  - `distributorAddress` (optional): If provided, only calculate fees for this distributor
- **Returns**: Promise that resolves when fee calculations are complete
- **Behavior**:
  - Reads all necessary data through FileManager
  - Validates data completeness before processing
  - Calculates daily fees for each distributor
  - Writes comprehensive report with results
  - Throws error if critical data is missing or invalid

## 6. Algorithm Details

### Fee Calculation Process

1. **Initialize**: Create FileManager instance
2. **Load Distributors**: Read distributor list using FileManager
3. **Filter Distributors**: If distributorAddress provided, filter to single distributor
4. **For Each Distributor**:
   - Load balance history from FileManager
   - Load distribution events from FileManager
   - Build chronological timeline of all dates with data
   - Sort balance entries by date
   - For each date with balance data:
     - If first date: balance change = 0 (no previous balance)
     - Otherwise: balance change = current balance - previous balance
     - Find all distribution events for this date
     - Sum distribution amounts: total distributions = sum of all values
     - Calculate daily fee = balance change + total distributions
     - Store result with date, balances, distributions, and fee
5. **Generate Report**: Compile all distributor results into structured report
6. **Write Results**: Save report using FileManager

### Data Validation

- Ensure all dates are in ISO format (YYYY-MM-DD)
- Verify balance values are valid numeric strings
- Confirm distribution amounts are non-negative
- Check for data gaps and report them without failing

### Edge Case Handling

1. **First Day**: No previous balance, so balance change = 0
2. **Missing Events**: If no events for a date, distributions = 0
3. **Data Gaps**: Report gaps but continue processing available data
4. **Zero Balances**: Valid scenario, process normally

## 7. Data Structures

### Input Types

```typescript
interface DistributorsData {
  distributors: Array<{
    address: string;
    metadata: {
      name: string;
      created_at: string;
    };
  }>;
}

interface BalanceData {
  metadata: {
    chain_id: number;
    reward_distributor: string;
  };
  balances: {
    [date: string]: {
      block_number: number;
      balance_wei: string;
    };
  };
}

interface RecipientRecievedEventData {
  metadata: {
    chain_id: number;
    distributor_address: string;
  };
  events: Array<{
    block_number: number;
    transaction_hash: string;
    log_index: number;
    timestamp: string;
    date: string;
    recipient: string;
    amount_wei: string;
  }>;
}
```

### Output Types

```typescript
interface FeeReport {
  metadata: {
    chain_id: number;
    generated_at: string;
    report_type: "daily_fees";
  };
  distributors: {
    [distributorAddress: string]: {
      name: string;
      daily_fees: Array<{
        date: string;
        start_balance_wei: string;
        end_balance_wei: string;
        balance_change_wei: string;
        distributions_wei: string;
        distributions_count: number;
        fee_wei: string;
      }>;
    };
  };
}
```

### Internal Calculation Types

```typescript
interface DailyFeeCalculation {
  date: string;
  startBalance: bigint;
  endBalance: bigint;
  balanceChange: bigint;
  distributions: bigint;
  distributionCount: number;
  totalFee: bigint;
}
```

## 8. Implementation Requirements

### Validation Rules

1. **Address Validation**:

   - All addresses must be valid Ethereum addresses
   - Addresses normalized to checksummed format

2. **Date Validation**:

   - All dates in ISO format (YYYY-MM-DD)
   - Dates must be chronologically ordered
   - Cannot calculate fees for future dates

3. **Amount Validation**:

   - All amounts must be valid numeric strings
   - Handle large numbers using bigint internally
   - Convert back to strings for output

4. **Data Completeness**:
   - Log warnings for missing data but continue processing
   - Clearly indicate data gaps in output

### Security Considerations

1. **Data Integrity**:

   - Validate all numeric values before processing
   - Use bigint to prevent overflow with large wei values
   - FileManager ensures atomic file operations

2. **Error Handling**:
   - Never expose system paths in error messages
   - Fail gracefully with descriptive error messages

## 9. Test Data Requirements

### Minimum Test Data

Integration tests require real blockchain data from Arbitrum Nova:

1. **Distributors**: Use actual reward distributor addresses from test data:

   - At least 5 distributors with varying creation dates
   - Mix of high-volume and low-volume distributors
   - Include distributors created at different times

2. **Balance Data**: For each test distributor:

   - Complete balance history for test period (minimum 30 days)
   - Include days with increasing and decreasing balances
   - Cover edge cases: zero balances, large balances

3. **Distribution Events**: For each test distributor:

   - All distribution events during test period
   - Include days with multiple distributions
   - Include days with no distributions
   - Varying distribution amounts

4. **Test Scenarios**:
   - Distributor with consistent daily fees
   - Distributor with sporadic activity
   - Distributor with no distributions (fees from balance changes only)
   - Distributor created mid-period
   - Full pipeline test: all distributors for complete date range

### Data Sources

Test data available in `__tests__/test-data/`:

- Distributor list with metadata
- Historical balance snapshots
- Distribution event records
- Expected fee calculation results for validation

## 10. Examples

### Basic Usage

```typescript
const calculator = new FeeCalculator(fileManager);

// Calculate fees for all distributors
await calculator.calculateFees();

// Calculate fees for specific distributor
await calculator.calculateFees("0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9");
```

### Sample Input/Output

**Input Data** (via FileManager):

- 2 distributors with 5 days of data each
- Balance snapshots for each day
- Distribution events scattered across days

**Output Report** (excerpt):

```json
{
  "metadata": {
    "chain_id": 42170,
    "generated_at": "2024-06-24T10:30:00Z",
    "report_type": "daily_fees"
  },
  "distributors": {
    "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
      "name": "ArbitrumHub",
      "daily_fees": [
        {
          "date": "2024-01-15",
          "start_balance_wei": "1500000000000000000000",
          "end_balance_wei": "1480000000000000000000",
          "balance_change_wei": "-20000000000000000000",
          "distributions_wei": "25000000000000000000",
          "distributions_count": 5,
          "fee_wei": "5000000000000000000"
        },
        {
          "date": "2024-01-16",
          "start_balance_wei": "1480000000000000000000",
          "end_balance_wei": "1490000000000000000000",
          "balance_change_wei": "10000000000000000000",
          "distributions_wei": "15000000000000000000",
          "distributions_count": 3,
          "fee_wei": "25000000000000000000"
        }
      ]
    }
  }
}
```

## 11. Out of Scope

The following features are explicitly NOT part of this component:

### Calculation Features

- **Cumulative fee calculations** (only daily fees are calculated)
- Multi-period aggregations (weekly, monthly totals)
- Fee rate calculations or percentages
- Predictive fee modeling
- Anomaly detection in fee patterns

### Performance Optimizations

- Parallel processing of distributors
- Incremental fee calculations (always recalculate from source data)
- Caching of intermediate results
- Database storage for faster queries

### Additional Analytics

- Fee comparisons between distributors
- Historical trend analysis
- Statistical summaries or averages
- Visualization or charting capabilities
- Real-time fee monitoring

### Data Management

- Direct file system access (must use FileManager)
- Data cleanup or archival
- Backup and recovery features
- Data migration tools

### User Interface

- Web dashboard or API endpoints
- Interactive querying capabilities
- Export to formats other than JSON
- Email or notification systems

These features should be implemented in separate components to maintain focus on the core fee calculation logic.
