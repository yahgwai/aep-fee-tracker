# System ensures only finalized blocks are processed

## Context

To avoid issues with blockchain reorganizations, the system must only process blocks that are considered finalized. On Arbitrum, blocks older than 1000 blocks are considered safe from reorganization.

## Current Behavior

No implementation exists. System could potentially process blocks that might be reorganized.

## Expected Behavior

- System queries the current block number from the RPC provider
- System subtracts 1000 from the current block number to get the safe block limit
- System uses this safe block limit to filter out dates that are too recent
- System only processes dates where the end-of-day block would be older than the safe limit

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Reorg Protection section)
- Architecture overview: `/workspace/docs/architecture.md` (Fail-fast principle)

## Blocking Issues

- Requires working RPC provider connection
