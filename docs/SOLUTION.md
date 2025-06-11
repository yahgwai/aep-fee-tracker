# AEP Fee Calculator - Solution Design

## Our Solution Approach

### Core Insight
To calculate total fees collected, we need to track:
- How the balance changes each day
- Every distribution that goes out

This gives us a complete picture: `Fees Collected = Current Balance + All Historical Distributions`

### Daily Snapshots
We capture distributor state every day at midnight UTC:
- Record the balance at end-of-day block
- Track all distributions that happened that day
- Calculate daily and cumulative fees

This enables incremental updates without reprocessing historical data.

## System Design

### Discovery Phase
First, we need to find all reward distributors:
```
Blockchain Events → Filter for Distributor Creation → Track New Distributors
```

### Data Collection Phase  
For each distributor, every day:
```
Get End-of-Day Balance → Record Distribution Events → Store Results
```

### Calculation Phase
Transform raw data into useful metrics:
```
Daily Fees = Balance Change + Distributions
Cumulative = Sum of All Daily Fees
```

## Implementation Strategy

### Incremental Processing
Each time the system runs:
1. Check existing JSON files to determine last processed date
2. Identify all dates between last processed and current date
3. For each missing date:
   - Find the last block before midnight UTC
   - Discover any new distributors
   - Collect balances and distribution events
   - Calculate and store daily fees
4. Generate updated reports with all available data