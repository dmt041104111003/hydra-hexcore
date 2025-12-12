const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    // match e2e tests ONLY
    testMatch: ['**/tests/**/*.e2e-spec.ts'],

    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: '<rootDir>/',
    }),

    modulePaths: ['<rootDir>/src'],

    // Increase timeout for e2e tests
    testTimeout: 30000,

    // Setup files to load .env.test
    setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],

    // JUnit reporter for CI
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: '.',
                outputName: 'junit.xml',
                classNameTemplate: '{classname}',
                titleTemplate: '{title}',
                ancestorSeparator: ' › ',
                usePathForSuiteName: 'true',
            },
        ],
    ],
};
