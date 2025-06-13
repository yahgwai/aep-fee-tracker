# System processes only missing dates incrementally

## Context

The Block Finder should support incremental processing, allowing it to resume after interruptions and avoid reprocessing dates that already have block numbers.

## Current Behavior

No implementation exists. System would reprocess all dates on every run.

## Expected Behavior

- System loads existing block numbers from storage before processing
- System filters the requested date range to only include missing dates
- System saves block numbers after finding each date's block (not batch saving)
- User can interrupt the process and resume later without losing progress
- System maintains consistency by processing dates in chronological order

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Date Processing Logic)
- Architecture overview: `/workspace/docs/architecture.md` (Incremental processing principle)
- FileManager atomic update behavior: `/workspace/src/file-manager.ts`

## Blocking Issues

- Requires FileManager's atomic update functionality
