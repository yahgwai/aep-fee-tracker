# Arbitrum Nova Block Timestamp Reference

This document contains verified block timestamps for Arbitrum Nova that are useful for testing.

## Verified Block Timestamps

### Key Blocks for Testing Midnight Boundaries

| Block Number | Unix Timestamp | UTC Date/Time           | Date         | Notes                                              |
| ------------ | -------------- | ----------------------- | ------------ | -------------------------------------------------- |
| 40268100     | 1705363148     | 2024-01-15 23:59:08 UTC | January 15th | 52 seconds before midnight - excellent for testing |
| 40268500     | 1705363277     | 2024-01-16 00:01:17 UTC | January 16th | 77 seconds after midnight                          |

### Verified Blocks by Date

| Date       | Block Number | UTC Date/Time           | Notes                      |
| ---------- | ------------ | ----------------------- | -------------------------- |
| 2024-01-15 | 40049000     | 2024-01-15 02:32:11 UTC | Early morning Jan 15       |
| 2024-01-15 | 40268100     | 2024-01-15 23:59:08 UTC | Last block before midnight |
| 2024-01-16 | 40268500     | 2024-01-16 00:01:17 UTC | First block after midnight |
| 2024-01-17 | 40740000     | 2024-01-17 20:57:16 UTC | Evening Jan 17             |

## Block Production Rate

- **Arbitrum Nova**: ~4 blocks per second
- **Blocks per day**: ~345,600 blocks

## Recommended Test Pairs

### For Testing Midnight Validation

Use these bounds that properly contain midnight:

```typescript
// January 15/16 midnight boundary
const lowerBound = 40268050; // Just before 40268100
const upperBound = 40268550; // Just after 40268500
// This range contains the midnight transition
```

### For Testing Binary Search

Use tight bounds around known blocks:

```typescript
// Tight bounds around the last block of Jan 15
const lowerBound = 40268000;
const upperBound = 40269000;
// Expected to find block ~40268100
```
