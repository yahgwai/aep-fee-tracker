# AEP Fee Calculator Requirements

## Executive Summary

The Arbitrum Ecosystem Program (AEP) Fee Calculator is a tool to track and calculate fees collected by reward distributors on the Arbitrum network. This document defines the functional and non-functional requirements for the system.

## Business Context

### Problem Statement

The Arbitrum Ecosystem Program needs to accurately track fees collected by various reward distributors to ensure proper accounting and transparency. Currently, this requires manual blockchain queries and calculations.

### Objectives

- Automate fee calculation for all AEP reward distributors
- Provide auditable, reproducible results
- Support both historical analysis and ongoing monitoring

### Stakeholders

- **Primary Users**: Arbitrum Foundation finance team
- **Secondary Users**: External auditors, governance participants
- **Operators**: DevOps team responsible for running daily updates

## Functional Requirements

### FR1: Distributor Discovery

- **FR1.1**: System MUST discover all reward distributors created through ArbOwner precompile
- **FR1.2**: System MUST identify distributor type (L2_BASE_FEE, L2_SURPLUS_FEE, L1_BASE_FEE, L1_SURPLUS_FEE)
- **FR1.3**: System MUST record complete audit trail for each distributor (creation tx, block, date)

### FR2: Balance Tracking

- **FR2.1**: System MUST retrieve end-of-day balances for each distributor
- **FR2.2**: System MUST handle distributors created mid-period
- **FR2.3**: System MUST store balance history for all tracked dates

### FR3: Outflow Tracking

- **FR3.1**: System MUST capture all RecipientRecieved events for each distributor
- **FR3.2**: System MUST aggregate daily outflow totals
- **FR3.3**: System MUST maintain detailed event logs for audit purposes

### FR4: Fee Calculation

- **FR4.1**: System MUST calculate daily fees using formula: `Balance_Today - Balance_Yesterday + Outflows_Today`
- **FR4.2**: System MUST calculate cumulative fees: `Balance_Current + Σ(All_Outflows_To_Date)`
- **FR4.3**: System MUST produce reports by distributor type and total

### FR5: Data Management

- **FR5.1**: System MUST persist all data in human-readable JSON format
- **FR5.2**: System MUST support incremental updates without reprocessing historical data
- **FR5.3**: System MUST maintain data integrity (no partial updates on failure)

## Non-Functional Requirements

### NFR1: Performance

- **NFR1.1**: Initial backfill of 3 years data MUST complete within 8 hours
- **NFR1.2**: Daily updates MUST complete within 5 minutes
- **NFR1.3**: System MUST handle rate limits gracefully with exponential backoff

### NFR2: Reliability

- **NFR2.1**: System MUST fail-fast on any error (no partial/incorrect data)
- **NFR2.2**: System MUST be idempotent (running twice produces same results)

### NFR3: Scalability

- **NFR3.1**: Architecture MUST allow parallel processing of distributors

### NFR4: Maintainability

- **NFR4.1**: Components MUST be independently testable
- **NFR4.2**: System MUST provide clear error messages for debugging

### NFR5: Security

- **NFR5.1**: System MUST NOT store or log private keys or json rpc urls

## Constraints

### Technical Constraints

- **C1**: MUST use Arbitrum archive node with full historical data
- **C2**: MUST be implemented in TypeScript
- **C3**: MUST run on Linux/Unix systems
- **C4**: MUST use only standard RPC methods (eth_getBalance, eth_getLogs, eth_getBlockByNumber)

### Business Constraints

- **C5**: MUST use UTC timezone for all date calculations
- **C6**: MUST preserve historical data (no deletions/modifications)

## Assumptions

- **A1**: No chain reorganizations beyond 100 blocks
- **A2**: The reward distributor addresses will not be used for any purpose other than AEP

## Success Criteria

1. **Accuracy**: Calculated fees match manual verification
2. **Completeness**: All distributors discovered and tracked

## Out of Scope

- Real-time fee tracking (only daily granularity)
- Fee distribution analysis (only collection)
- Web interface (CLI only)
- Automated remediation of failures

## Acceptance Tests

### AT1: Historical Accuracy

Run calculator for known period and verify results match manual calculations

### AT2: Incremental Updates

Run daily update and verify only new data is processed

### AT3: Error Handling

Simulate RPC failures and verify system fails gracefully

### AT4: Performance

Process 3 years of data and verify completion within 8 hours

### AT5: Data Integrity

Interrupt processing and verify no partial data is written
