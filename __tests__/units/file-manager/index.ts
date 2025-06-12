// This file serves as documentation for the complete FileManager test suite
// To run all FileManager tests, use:
// npm test -- __tests__/units/file-manager/

// Test organization:
// - core-structure.test.ts: Core FileManager functionality tests
// - block-numbers.test.ts: Block number data management tests
// - distributors.test.ts: Distributor registry management tests
// - validation-helpers.test.ts: Internal validation method tests
// - distributor-balances/: Distributor balance tracking tests
//   - read.test.ts: Reading balance data
//   - write-validation.test.ts: Balance write validation
//   - write-operations.test.ts: Balance file operations
// - distributor-outflows/: Distributor outflow tracking tests
//   - read.test.ts: Reading outflow data
//   - write-validation.test.ts: Outflow write validation
//   - write-operations.test.ts: Outflow file operations

// Note: This file intentionally does not import other test files to avoid
// running tests multiple times when using Jest's directory matching.
