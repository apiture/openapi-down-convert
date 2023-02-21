/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testRegex: '(test/.*|(\\.|/)(test|spec))\\.ts?$',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js']
};
