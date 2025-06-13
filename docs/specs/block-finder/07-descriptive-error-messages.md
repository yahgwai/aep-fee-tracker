# Provide descriptive error messages with context

## Context

When errors occur during block finding, the system must provide clear, actionable error messages that include all relevant context to help diagnose and resolve issues.

## Current Behavior

No implementation exists. Errors would lack necessary context.

## Expected Behavior

- Error messages include the operation that failed
- Error messages include all input values (date, search bounds)
- Error messages include the actual error from RPC or filesystem
- Error messages include suggested resolution steps
- Search errors include last checked block and its timestamp when relevant
- File system errors clearly indicate read vs write failures
- Chain ID mismatch errors show both provider and stored chain IDs
- All errors maintain the context chain from lower-level operations

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Error Messages section with example)
- Architecture overview: `/workspace/docs/architecture.md` (Error handling principles)

## Out of Scope

- Error telemetry or reporting
- Automatic error recovery beyond retries
- GUI error presentation
