/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@scripts/(.*)$': '<rootDir>/src/scripts/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/shared/infra/http/middlewares/$1',
    '^@routes/(.*)$': '<rootDir>/src/shared/infra/http/routes/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@gateway/(.*)$': '<rootDir>/src/gateway/$1',
  },
  setupFiles: ['<rootDir>/config/jest.setup.ts'],
  clearMocks: true,
};
