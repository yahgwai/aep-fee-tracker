# CLI Technical Specification

## 1. Overview

The AEP Fee Calculator system requires a command-line interface to orchestrate the execution of its components in the correct sequence. The CLI serves as the single entry point for running the complete fee calculation pipeline, handling configuration and ensuring components execute in dependency order.

## 2. Purpose

### Primary Objectives

- Execute all fee calculation components in the correct sequence
- Provide a simple command-line interface with minimal configuration
- Ensure components run with proper dependencies satisfied

### Component Responsibilities

- Parse and validate command-line arguments
- Set up environment configuration for components
- Execute components in dependency order
- Propagate component failures

### Success Criteria

- All components execute successfully in sequence
- CLI exits with appropriate error codes on failure
- Components receive required configuration via environment variables

## 3. Dependencies

### External Libraries/Frameworks

- Node.js runtime environment
- Command-line argument parser (minimist or similar)
- Child process execution utilities from Node.js stdlib

### System Component Dependencies

- block-finder.ts
- distributor-detector.ts
- balance-fetcher.ts
- recipient-recieved-scanner.ts
- fee-calculator.ts

### Infrastructure Requirements

- Access to Arbitrum Nova archive RPC endpoint
- Write access to store directory
- Node.js 18+ runtime

## 4. Data Flow

### Process Flow

1. CLI parses command-line arguments
2. Validates required --rpc-url parameter
3. Sets up environment variables for components
4. Executes components in sequence:
   ```
   Block Finder
       ↓
   Distributor Detector
       ↓
   Balance Fetcher
       ↓
   Event Scanner
       ↓
   Fee Calculator
   ```
5. Each component reads/writes to shared store directory
6. CLI exits with appropriate status code

### Integration Points

- Environment variables: RPC_URL, CHAIN_ID, STORE_DIR
- File system: Shared store directory for inter-component data exchange
- Process execution: Child process spawning for each component

## 5. Public API

### Command Line Interface

```
aep-fee-calculator --rpc-url <url> [--start-date <date>] [--end-date <date>] [--store-dir <path>]
```

### Parameters

- `--rpc-url` (required): Arbitrum Nova archive RPC endpoint URL
- `--start-date` (optional): Start date for processing in YYYY-MM-DD format
- `--end-date` (optional): End date for processing in YYYY-MM-DD format
- `--store-dir` (optional): Directory for storing calculation data (defaults to ./store)

### Exit Codes

- 0: Success - all components executed successfully
- 1: Failure - component execution failed or validation error

## 6. Algorithm Details

### Execution Logic

1. **Argument Parsing**

   - Extract command-line arguments
   - Validate --rpc-url is provided
   - Parse optional date parameters if provided
   - Set store directory path

2. **Environment Setup**

   - Set RPC_URL environment variable from --rpc-url
   - Set CHAIN_ID to 42170 (Arbitrum Nova)
   - Set STORE_DIR if provided via --store-dir
   - Pass through START_DATE and END_DATE if provided

3. **Component Execution**

   - For each component in sequence:
     - Spawn child process executing the component
     - Wait for completion
     - If exit code is non-zero, terminate with error
   - Components to execute in order:
     - node dist/block-finder.js
     - node dist/distributor-detector.js
     - node dist/balance-fetcher.js
     - node dist/recipient-recieved-scanner.js
     - node dist/fee-calculator.js

4. **Error Propagation**
   - If any component fails, immediately exit with status 1
   - Do not continue to subsequent components after failure

## 7. Data Structures

### Input Validation

```typescript
interface CLIArguments {
  "rpc-url": string; // Required
  "start-date"?: string; // Optional, format: YYYY-MM-DD
  "end-date"?: string; // Optional, format: YYYY-MM-DD
  "store-dir"?: string; // Optional, defaults to './store'
}
```

### Environment Configuration

```typescript
interface EnvironmentConfig {
  RPC_URL: string; // From --rpc-url
  CHAIN_ID: "42170"; // Hard-coded for Arbitrum Nova
  STORE_DIR?: string; // From --store-dir or default
  START_DATE?: string; // From --start-date
  END_DATE?: string; // From --end-date
}
```

## 8. Implementation Requirements

### Validation Rules

1. **RPC URL Validation**

   - Must be provided
   - Must be a valid URL format (http:// or https://)

2. **Date Validation**

   - If provided, must be in YYYY-MM-DD format
   - If both dates provided, start-date must be before or equal to end-date
   - Dates must be valid calendar dates

3. **Store Directory Validation**
   - If provided, must be a valid file system path
   - Parent directory must exist

### Security Considerations

- No authentication required - relies on RPC endpoint authentication
- No sensitive data handling beyond RPC URL
- File system access limited to store directory

## 9. Test Data Requirements

### Integration Testing

- Mock RPC endpoint for testing component integration
- Sample store directory with pre-populated test data
- Test cases for various date ranges and error conditions

### Test Scenarios

- Successful execution with all components
- Component failure propagation
- Invalid argument handling
- Date range validation

## 10. Examples

### Basic Usage

```bash
# Run full pipeline with required RPC URL
aep-fee-calculator --rpc-url https://nova.arbitrum.io/rpc
```

### With Date Range

```bash
# Process specific date range
aep-fee-calculator --rpc-url https://nova.arbitrum.io/rpc --start-date 2024-01-01 --end-date 2024-01-31
```

### Custom Store Directory

```bash
# Use custom store location
aep-fee-calculator --rpc-url https://nova.arbitrum.io/rpc --store-dir /data/aep-fees
```

### Expected Output

The CLI produces no output of its own. All output comes from the individual components. On success, exits with code 0. On failure, exits with code 1 and the failing component's error output is displayed.

## 11. Out of Scope

The following features are explicitly NOT included:

### Excluded Features

- Logging infrastructure or verbose output options
- Progress indicators or status updates
- Individual component execution (must run full pipeline)
- Parallel component execution
- Component restart/retry logic
- Configuration file support
- Interactive mode or prompts
- Data validation beyond basic argument checking
- Report generation or formatting
- Caching mechanisms
- Performance optimizations
- Component health checks
- Partial pipeline execution
- Cleanup operations on failure
