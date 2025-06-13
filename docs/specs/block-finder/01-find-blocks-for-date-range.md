# Find end-of-day blocks for date range

## Context

The Block Finder component needs to find the last block before midnight UTC for each date in a given range. This is the main entry point that orchestrates the entire block finding process.

## Current Behavior

No implementation exists. The system cannot determine which blocks correspond to end-of-day snapshots.

## Expected Behavior

- User can request block numbers for a date range by providing start and end dates as Date objects
- System reads existing block numbers from storage
- System validates chain ID from provider matches stored data (if data exists)
- System identifies which dates in the range are missing block numbers
- System skips dates that are too recent (less than 1000 blocks old) to ensure finality
- System finds and stores the end-of-day block for each missing date
- System saves block numbers with chain ID from `(await provider.getNetwork()).chainId`
- System returns complete mapping of all dates to their end-of-day blocks
- Date validation ensures start date is not after end date and dates are valid Date objects

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md`
- Architecture overview: `/workspace/docs/architecture.md`
- FileManager implementation: `/workspace/src/file-manager.ts`
- Block numbers interface: `/workspace/src/types/block-numbers.ts`

## Blocking Issues

- FileManager must have working block numbers read/write methods (already implemented)
