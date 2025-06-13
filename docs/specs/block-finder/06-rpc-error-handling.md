# Handle RPC communication errors with retry logic

## Context

RPC providers can experience temporary issues like rate limiting, connection timeouts, or network errors. The system needs to handle these gracefully with appropriate retry logic.

## Current Behavior

No implementation exists. RPC errors would cause immediate failure.

## Expected Behavior

- System retries failed RPC calls up to 3 times
- System uses exponential backoff between retries (1s, 2s, 4s)
- System handles connection timeouts gracefully
- System handles rate limiting responses appropriately
- System handles invalid or malformed RPC responses
- After all retries are exhausted, system provides clear error message with context

## Required Context

- Original specification: `/workspace/docs/specs/block-finder.md` (Retry Strategy section)
- Architecture overview: `/workspace/docs/architecture.md` (Error handling principles)
- Error message requirements from spec

## Out of Scope

- Circuit breaker patterns
- Provider rotation or fallback providers
- Request queuing or rate limit management
