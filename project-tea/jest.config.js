/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000, // 30s for real binary executions (GitleaksExecutor, etc.)
  testMatch: [
    // Unit tests
    '**/src/test/unit/**/*.test.ts',
    // Integration tests that use Jest (no vscode API dependency)
    '**/src/test/integration/services/**/*.test.ts',
    '**/src/test/integration/stores/**/*.test.ts',
    '**/src/test/integration/parsers/**/*.test.ts',
  ],
  modulePathIgnorePatterns: ['<rootDir>/out/'],
};
