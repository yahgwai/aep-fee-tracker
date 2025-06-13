# System determines search bounds for each date

## Context

To efficiently search for end-of-day blocks, the system needs to determine reasonable upper and lower bounds for the binary search. Using the previous day's block as a lower bound significantly reduces the search space.

## Current Behavior

No implementation exists. System would need to search the entire blockchain history.

## Expected Behavior

- System checks if the previous day's block number is already known
- When previous day exists, system uses it as the lower bound
- When previous day doesn't exist, system uses a reasonable default (e.g., genesis block or estimated block)
- System uses the safe current block as the upper bound
- System ensures bounds are valid (lower <= upper)

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (getSearchBounds function)
- Architecture overview: `/workspace/docs/architecture.md`
- Block numbers data structure: `/workspace/src/types/block-numbers.ts`

## Out of Scope

- Adaptive bounds based on block production rate
- Complex estimation algorithms for initial bounds
