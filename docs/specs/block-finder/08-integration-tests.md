# Write integration tests for block-finder

## Context

The block finder component needs integration tests that verify it works correctly with real RPC providers and the FileManager component. These tests should use real blockchain data.

## Current Behavior

No tests exist for the block finder functionality.

## Expected Behavior

- Integration tests verify block finder works with real Arbitrum RPC endpoint
- Tests verify correct interaction with FileManager for reading and writing block numbers
- Tests verify chain ID is fetched from provider and stored correctly
- Tests verify chain ID mismatch detection when switching networks
- Tests verify incremental processing works correctly (resume after interruption)
- Tests verify proper handling of date ranges including edge cases
- Tests verify reorg protection by checking safe block calculations
- Tests use the public Arbitrum Nova RPC endpoint: `https://nova.arbitrum.io/rpc`
- Tests verify error scenarios with real RPC errors (invalid blocks, network issues)

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Testing Notes section)
- Architecture overview: `/workspace/docs/architecture.md` (Testing philosophy)
- FileManager tests for patterns: `/workspace/src/file-manager.test.ts`

## Blocking Issues

- Block finder implementation must be complete
