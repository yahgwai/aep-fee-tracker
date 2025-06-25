/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/minimal-ci-test.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        strict: true
      }
    }]
  },
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  setupFiles: ['<rootDir>/jest.setup.js']
};