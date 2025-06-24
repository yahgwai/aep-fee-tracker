# RecipientRecieved Event Test Data

This directory contains real blockchain data for RecipientRecieved events from Nova Arbitrum reward distributors.

## Data Structure

Each JSON file is named after the distributor address and contains:

```typescript
{
  "chain_id": 42170,              // Nova Arbitrum chain ID
  "distributor_address": "0x...", // The distributor contract address
  "events": [                     // Array of RecipientRecieved events
    {
      "blockNumber": 12345,
      "transactionHash": "0x...",
      "logIndex": 0,
      "address": "0x...",         // Contract that emitted the event
      "topics": ["0x..."],        // Event topics (signature + indexed params)
      "data": "0x...",           // Non-indexed event data
      "recipient": "0x...",      // Parsed recipient address (checksummed)
      "value": "1000000..."      // Parsed value in wei (decimal string)
    }
  ],
  "block_range": {
    "start": 12345,              // First block with events
    "end": 67890                 // Last block with events
  }
}
```

## Summary

- Total distributors scanned: 5
- Distributors with events: 3
- Total events found: 320

## Distributors with Events

- 0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce
- 0x509386DbF5C0BE6fd68Df97A05fdB375136c32De
- 0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f

## Distributors without Events

- 0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB
- 0xdff90519a9DE6ad469D4f9839a9220C5D340B792

## Data Collection

Data was collected on 2025-06-24T09:52:23.617Z from Nova Arbitrum RPC.
