# AEP Fee Calculator - Technical Specification

## RPC Methods

### eth_getBalance
```
eth_getBalance(address, blockNumber)
```
- `address`: Reward distributor contract address
- `blockNumber`: Hex-encoded block number

### eth_getBlockByNumber
```
eth_getBlockByNumber(blockNumber, fullTransactions)
```
- `blockNumber`: Hex-encoded block number
- `fullTransactions`: Boolean (false - we only need block timestamps)
- Used by block-finder to get block timestamps for binary search


### eth_getLogs

#### Distributor Detection
Track distributor creation using `OwnerActs` events:

```solidity
event OwnerActs(bytes4 indexed method, address indexed owner, bytes data);
```

**Method Signatures:**
- `0xee95a824` - L2 Base Fee
- `0x2d9125e9` - L2 Surplus Fee  
- `0x934be07d` - L1 Surplus Fee
- L1 Base Fee detection is being skipped for now (see OUTSTANDING.md)

#### Outflow Tracking
Track outflows using the `RecipientRecieved` event from [RewardDistributor.sol#L117](https://github.com/OffchainLabs/fund-distribution-contracts/blob/main/src/RewardDistributor.sol#L117)

```solidity
event RecipientRecieved(address indexed recipient, uint256 value);
```

**Note:** The misspelling of "Received" as "Recieved" is intentional - this is how the event is defined in the deployed contract.

**Topic0:** `0x8b2a2b28e169eb0e4f62578e9d12f747d7bd0fe1ebc935af28387c18034d7cc0`

## Data Schemas

See the [File Manager Specification](specs/file-manager.md#data-schemas) for detailed JSON schemas and data structures.

## Final Calculations

### Daily Fees
To calculate fees collected on a specific day for a distributor:

```
Daily_Fees = Balance_Today - Balance_Yesterday + Outflows_Today
```

### Cumulative Fees
To calculate total fees collected up to a specific date:

```
Cumulative_Fees = Balance_Current + Σ(All_Outflows_To_Date)
```