/**
 * Jest configuration for the EcoWaste backend.
 *
 * Unit tests live alongside source code as `src/** /*.test.ts` and must not
 * require a database connection. Database-backed integration tests are kept
 * separate (see `tests/` and the `test:integration` script).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};