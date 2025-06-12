# AEP Fee Calculator - Overview

## The Problem

The Arbitrum Ecosystem Program (AEP) collects fees through special contracts called "reward distributors". These contracts:

- Receive a portion of network fees automatically
- Distribute those fees to ecosystem participants
- Need to be tracked for accounting and transparency

Currently, calculating how much fees have been collected requires:

- Manual blockchain queries for each distributor
- Complex calculations involving balance changes and transfers
- No automated way to track new distributors
- Error-prone manual processes

## Understanding Fee Collection

Think of reward distributors like automated savings accounts:

1. **Fees flow in** - Network automatically deposits a portion of fees
2. **Balance grows** - Distributors accumulate fees over time
3. **Distributions happen** - Periodically send fees to recipients
4. **Fees collected** = Everything that came in (current balance + all distributions)

The challenge: The blockchain only shows current state, not historical flows.

## Why This Matters

### Financial Reporting

- Need accurate fee collection data for financial statements
- Auditors require verifiable calculations
- Stakeholders need transparency into program performance

### Operational Efficiency

- Manual calculations take hours/days
- Prone to human error
- No standardized methodology
- Difficult to track new distributors

### Governance & Transparency

- Community needs visibility into fee flows
- Data should be publicly verifiable
- Historical trends inform future decisions

## The Core Challenge

Calculating historical fee collection from blockchain data requires:

1. **Historical State Reconstruction** - The blockchain doesn't store historical balances directly
2. **Event Aggregation** - Thousands of distribution events must be tracked and summed
3. **Distributor Discovery** - New distributors can be created at any time
4. **Data Consistency** - Calculations must be reproducible and verifiable

Without automation, this process is unsustainable as the number of distributors and time period grows.

## Next Steps

For our solution approach, see:

- [Solution Design](SOLUTION.md) - How we solve this problem

For detailed requirements and technical details, see:

- [Requirements](REQUIREMENTS.md) - Business requirements and constraints
- [Architecture](ARCHITECTURE.md) - Technical component design
- [Technical Spec](TECHNICAL_SPEC.md) - Implementation details
