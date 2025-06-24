# Fee Calculator Technical Specification

## 1. Overview

The Fee Calculator is the final component in the AEP Fee Calculator pipeline that computes daily total collection metrics for reward distributors on the Arbitrum Nova network. It analyzes balance changes and distribution events to determine how much each distributor collected in total for each day, providing transparent tracking for the Arbitrum Expansion Program.

## 2. Purpose

### Primary Objectives

- Calculate daily totals for each tracked reward distributor
- Analyze balance changes and distribution events to determine total collection
- Generate comprehensive reports showing daily total breakdowns
- Support incremental processing for efficient updates

### Component Responsibilities

- Read distributor data, balances, and events through FileManager
- Compute daily total amounts using balance changes and distributions
- Validate data consistency before calculations
- Output structured fee reports

### Success Criteria

- All distributors have accurate daily total calculations for applicable dates
- Total calculations correctly reflect the formula: Daily Total = Balance Change + Distributions
- Component throws error if critical data is missing
- Reports clearly show total breakdowns per distributor per day

## 3. Dependencies

### External Libraries

- Node.js built-in modules: `fs/promises`, `path`
- No external dependencies required

### System Components

- **FileManager**: Exclusive interface for all data access (distributors, balances, events)

### Infrastructure Requirements

- Read access to stored distributor, balance, and event data through FileManager
- Write permissions for total calculation results

## 4. Data Flow

### Input Flow

All data access exclusively through FileManager functions:

1. Use FileManager to read list of all tracked distributors
2. For each distributor:
   - Use FileManager to read balance history data
   - Use FileManager to read distribution event data

### Process Flow

1. Load all distributor addresses from FileManager
2. For each distributor:
   - Retrieve complete balance history
   - Retrieve all distribution events
   - Sort data chronologically
   - For each day with balance data:
     - Calculate balance change from previous day
     - Sum distributions for that day
     - Compute daily total = balance change + distributions
   - Store calculated totals in memory
3. Generate comprehensive report
4. Write results using FileManager

### Output Flow

- Total calculation results written through FileManager
- Single report file containing all distributor daily totals (completely overwrites any existing report)
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

- **Purpose**: Calculate daily totals for all distributors or a specific distributor
- **Parameters**:
  - `distributorAddress` (optional): If provided, only calculate fees for this distributor
- **Returns**: Promise that resolves when total calculations are complete
- **Behavior**:
  - Reads all necessary data through FileManager
  - Calculates daily totals for each distributor
  - Writes comprehensive report with results
  - Throws error if critical data is missing or invalid

## 6. Calculation Process

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
     - Calculate daily total = balance change + total distributions
     - Store result with date, balances, distributions, and total
5. **Generate Report**: Compile all distributor results into structured report
6. **Write Results**: Save report using FileManager (completely overwrites any existing report)

### Edge Case Handling

1. **First Day**: No previous balance, so balance change = 0
2. **Missing Events**: If no events for a date, distributions = 0
3. **Data Gaps**: Throw error if critical data is missing
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
  };
  distributors: {
    [distributorAddress: string]: {
      name: string;
      daily_totals: Array<{
        date: string;
        start_balance_wei: string;
        end_balance_wei: string;
        balance_change_wei: string;
        distributions_wei: string;
        distributions_count: number;
        total_wei: string;
      }>;
    };
  };
}
```

## 8. Implementation Requirements

### Security Considerations

1. **Error Handling**:
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
   - The implementer of the integration tests should choose what tests to write at their discretion based on the available data and edge cases they identify

### Available Test Data

Test data available in `__tests__/test-data/`:

- **Distributor list**: Available in `distributor-detector/distributor-creation-events-raw.json` with 5 distributors
- **Historical balance snapshots**: Available in `distributor-detector/balance_data/` for all 5 distributors across 9 dates (2022-07-11 to 2023-03-17)
  - **Note**: Need to create a test script that uses the balance fetcher to populate at least 30 dates worth of balance data. The script should:
    - Use the block finder to populate blocks per date
    - Use the balance fetcher to get balances for those blocks
    - Be configurable with a date range parameter
    - This should be one of the first tickets when creating implementation tasks from this spec
- **Distribution event records**: Available in `recipient-recieved/` directory with RecipientRecieved events for 3 of the 5 distributors (320 total events)

### Missing Test Data

The following test data needs to be generated:

- **Expected total calculation results**: JSON files with pre-calculated expected daily totals for each distributor to validate the fee calculator output. This should include:
  - Daily balance changes
  - Daily distribution totals
  - Calculated daily totals (balance change + distributions)
  - Should cover edge cases like first day, missing events, data gaps
  - **Note**: An independent script should be created to generate this test data from the available data. This should be one of the first tickets when creating implementation tasks from this spec.

## 10. Examples

### Basic Usage

```typescript
const calculator = new FeeCalculator(fileManager);

// Calculate totals for all distributors
await calculator.calculateFees();

// Calculate totals for specific distributor
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
    "chain_id": 42170
  },
  "distributors": {
    "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
      "name": "ArbitrumHub",
      "daily_totals": [
        {
          "date": "2024-01-15",
          "start_balance_wei": "1500000000000000000000",
          "end_balance_wei": "1480000000000000000000",
          "balance_change_wei": "-20000000000000000000",
          "distributions_wei": "25000000000000000000",
          "distributions_count": 5,
          "total_wei": "5000000000000000000"
        },
        {
          "date": "2024-01-16",
          "start_balance_wei": "1480000000000000000000",
          "end_balance_wei": "1490000000000000000000",
          "balance_change_wei": "10000000000000000000",
          "distributions_wei": "15000000000000000000",
          "distributions_count": 3,
          "total_wei": "25000000000000000000"
        }
      ]
    }
  }
}
```

## 11. Out of Scope

The following features are explicitly NOT part of this component:

### Calculation Features

- **Cumulative total calculations** (only daily totals are calculated)
- Multi-period aggregations (weekly, monthly totals)
- Total rate calculations or percentages
- Predictive modeling
- Anomaly detection in collection patterns

### Performance Optimizations

- Parallel processing of distributors
- Incremental total calculations (always recalculate from source data)
- Caching of intermediate results
- Database storage for faster queries

### Additional Analytics

- Total comparisons between distributors
- Historical trend analysis
- Statistical summaries or averages
- Visualization or charting capabilities
- Real-time monitoring

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

These features should be implemented in separate components to maintain focus on the core total calculation logic.
