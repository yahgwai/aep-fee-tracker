# System finds last block before midnight using binary search

## Context

For each date that needs processing, the system must find the exact block that represents the last block mined before midnight UTC. This requires efficient searching through blockchain history.

## Current Behavior

No implementation exists. System cannot identify which block represents the end of a given day.

## Expected Behavior

- System performs binary search between given lower and upper bounds
- System validates that the upper bound timestamp is >= the target midnight timestamp
- System queries block timestamps via RPC to determine if block is before or after midnight
- System finds the highest block number whose timestamp is before the target midnight
- Search converges to find the exact last block before midnight UTC
- System handles the case where all blocks in range are after midnight
- System handles the case where all blocks in range are before midnight
- System throws descriptive error if search bounds do not contain midnight

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Binary Search Algorithm section)
- Architecture overview: `/workspace/docs/architecture.md`
- Example of ethers.js provider usage in the codebase

## Out of Scope

- Caching of block timestamps during search
- Parallel searching for multiple dates
