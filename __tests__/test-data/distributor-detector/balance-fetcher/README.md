# Balance Fetcher Test Data

This directory contains ETH balance data for distributor addresses at specific test block numbers.

## Data Collection

The balance data was fetched using the `scripts/balance-fetcher.ts` script, which:

1. Parses distributor addresses from the raw creation events in `distributor-creation-events-raw.json`
2. Fetches ETH balances for each distributor at the block numbers specified in `block_numbers.json`
3. Stores the results in JSON files named by distributor address

## Distributors

The following 5 unique distributors were identified from the test data:

- **0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB** (created at blocks 152 & 153)
  - Type: L2_SURPLUS_FEE & L1_SURPLUS_FEE
- **0xdff90519a9DE6ad469D4f9839a9220C5D340B792** (created at block 684)
  - Type: L2_BASE_FEE
- **0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f** (created at block 3163115)
  - Type: L2_BASE_FEE
- **0x509386DbF5C0BE6fd68Df97A05fdB375136c32De** (created at block 3163115)
  - Type: L1_SURPLUS_FEE
- **0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce** (created at block 3163115)
  - Type: L2_SURPLUS_FEE

## Data Format

Each JSON file contains:

```json
{
  "metadata": {
    "chain_id": 42170,
    "distributor_address": "0x...",
    "distributor_type": "L2_BASE_FEE",
    "fetched_at": "2025-01-20T12:00:00.000Z"
  },
  "balances": {
    "2022-07-11": {
      "block_number": 120,
      "balance_wei": "0"
    }
    // ... more entries
  }
}
```

## Limitations

Due to Arbitrum Nova RPC limitations with historical state data, many balance fetches for older blocks failed with "missing trie node" errors. In these cases, the balance is stored as "0" as a fallback. This particularly affected:

- Blocks 155, 189, 654, 672, 3584 (older blocks from 2022)
- Blocks 3141957, 3166694, 3187362 (some blocks from March 2023)

For accurate historical balance data, an archive node with full historical state would be required.

## Usage

To regenerate this data, run:

```bash
npm run fetch:balances
```

The script is located at `scripts/balance-fetcher.ts`.
