# RecipientRecieved Event Test Data

This directory contains test data for RecipientRecieved events from Nova Arbitrum reward distributors.

## ⚠️ Mock Data Notice

Due to rate limiting on the public Nova Arbitrum RPC endpoint, this directory currently contains **mock data** that follows the expected structure of real RecipientRecieved events. The mock data is realistic and suitable for testing the scanner implementation.

To gather real data, you would need:

1. Access to a Nova Arbitrum archive node without rate limits
2. Or a paid RPC service with higher rate limits
3. Or implement patient retry logic that respects rate limits (could take hours/days)

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

- Total distributors: 3
- Total mock events: 35
- Event signature: 0x8b2a2b28e169eb0e4f62578e9d12f747d7bd0fe1ebc935af28387c18034d7cc0

## Mock Data Characteristics

The mock data includes:

- Events spanning multiple blocks
- Various recipient addresses
- Both small and large value transfers (1x, 10x, 1000x multipliers)
- Proper event encoding following Ethereum standards
- Checksummed addresses

## Future Work

To replace with real data:

1. Obtain access to a reliable Nova Arbitrum RPC endpoint
2. Run `scripts/gather-recipient-recieved-events.ts` with proper rate limiting
3. Verify the actual event signature matches our expectation
4. Update this README with real data statistics
