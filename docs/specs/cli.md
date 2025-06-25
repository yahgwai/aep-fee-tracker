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
- Set up configuration for components
- Execute components in dependency order
- Propagate component failures

### Success Criteria

- All components execute successfully in sequence
- CLI exits with appropriate error codes on failure
- Components receive required configuration via direct parameters or environment variables

## 3. Dependencies

### External Libraries/Frameworks

- Node.js runtime environment
- Command-line argument parser (minimist or similar)

### System Component Dependencies

- block-finder.ts
- distributor-detector.ts
- balance-fetcher.ts
- recipient-recieved-scanner.ts
- fee-calculator.ts

### Infrastructure Requirements

- Access to an archive RPC endpoint
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
   Recipient Recieved Scanner
       ↓
   Fee Calculator
   ```
5. Each component reads/writes to shared store directory
6. CLI exits with appropriate status code

### Integration Points

- Configuration: Parameters passed directly to components or via environment variables
- File system: Shared store directory for inter-component data exchange
- Component execution: Direct function calls within the same process

## 5. Public API

### Command Line Interface

```
aep-fee-calculator --rpc-url <url> [--start-date <date>] [--end-date <date>] [--store-dir <path>]
```

### Parameters

- `--rpc-url` (required): Archive RPC endpoint URL
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

2. **Configuration Setup**

   - Configuration can be provided via command-line arguments or environment variables
   - Pass RPC_URL from --rpc-url (or use existing RPC_URL env var)
   - Pass STORE_DIR if provided via --store-dir (or use existing STORE_DIR env var)
   - Pass START_DATE and END_DATE if provided (or use existing env vars)

3. **Component Execution**

   - For each component in sequence:
     - Execute the component directly within the same process
     - Wait for completion
     - If component throws an error, terminate with error
   - Components to execute in order:
     - blockFinder()
     - distributorDetector()
     - balanceFetcher()
     - recipientRecievedScanner()
     - feeCalculator()

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

### Component Configuration

```typescript
interface ComponentConfig {
  RPC_URL: string; // From --rpc-url or environment
  STORE_DIR?: string; // From --store-dir or environment or default
  START_DATE?: string; // From --start-date or environment
  END_DATE?: string; // From --end-date or environment
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
aep-fee-calculator --rpc-url https://your-archive-node.com/rpc
```

### With Date Range

```bash
# Process specific date range
aep-fee-calculator --rpc-url https://your-archive-node.com/rpc --start-date 2024-01-01 --end-date 2024-01-31
```

### Custom Store Directory

```bash
# Use custom store location
aep-fee-calculator --rpc-url https://your-archive-node.com/rpc --store-dir /data/aep-fees
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
