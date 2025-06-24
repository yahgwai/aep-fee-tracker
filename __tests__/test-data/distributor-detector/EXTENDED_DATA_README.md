# Extended Test Data Documentation

## Overview

This directory contains extended test data for the AEP Fee Tracker, including comprehensive balance data spanning multiple months for integration testing.

## Data Generation

The extended test data was generated using the `populate-test-balances` script:

```bash
npm run populate-test-balances -- --start 2022-07-11 --end 2023-12-31
```

This provides over 500 days of balance data for all test distributors, far exceeding the minimum 30-day requirement specified in the fee calculator spec.

## Data Structure

### Balance Data (`balance_data/`)

Each distributor address has its own directory containing a `balances.json` file with daily balance snapshots:

```json
{
  "metadata": {
    "chain_id": 42170,
    "reward_distributor": "0x..."
  },
  "balances": {
    "YYYY-MM-DD": {
      "block_number": 12345,
      "balance_wei": "1000000000000000000"
    }
  }
}
```

### Block Numbers (`block_numbers.json`)

Maps dates to end-of-day block numbers on Arbitrum Nova:

```json
{
  "metadata": {
    "chain_id": 42170
  },
  "blocks": {
    "YYYY-MM-DD": 12345
  }
}
```

### Distributors (`distributors.json`)

Contains information about all reward distributors:

```json
{
  "metadata": {
    "chain_id": 42170,
    "arbowner_address": "0x0000000000000000000000000000000000000070",
    "last_scanned_block": 3163115
  },
  "distributors": {
    "0x...": {
      "type": "L2_SURPLUS_FEE",
      "block": 152,
      "date": "2022-07-12",
      "tx_hash": "0x...",
      "method": "0xfcdde2b4",
      "owner": "0x...",
      "event_data": "0x...",
      "is_reward_distributor": true,
      "distributor_address": "0x..."
    }
  }
}
```

## Converted Distributor Events

The `convert-distributor-events.ts` script was used to transform raw blockchain events into the structured format used by the distributor detector. This ensures test data accurately reflects real blockchain state.

## Test Distributors

The following distributors are included in the test data:

1. **0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB** - L2_SURPLUS_FEE (created 2022-07-12)
2. **0xdff90519a9DE6ad469D4f9839a9220C5D340B792** - L2_BASE_FEE (created 2022-06-24)
3. **0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce** - L1_SURPLUS_FEE (created 2023-08-10)
4. **0x509386DbF5C0BE6fd68Df97A05fdB375136c32De** - L1_BASE_FEE (created 2022-07-12)
5. **0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f** - L2_SURPLUS_FEE (created 2023-03-15)

## Usage in Tests

This extended data enables comprehensive integration testing of:

- Multi-day fee calculations
- Balance trend analysis
- Edge cases (zero balances, large balances)
- Long-term distributor behavior
- Data consistency across components

## Data Integrity

All data was fetched from the Arbitrum Nova blockchain and represents actual on-chain state at the specified block numbers. The data has been validated for:

- Correct date-to-block mappings
- Valid balance values in wei
- Proper distributor metadata
- Consistent chain ID (42170)
