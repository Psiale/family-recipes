module.exports = {
  preset: 'jest-expo',
  // Native UI startup with coverage is slower on shared CI runners.
  testTimeout: process.env.CI ? 15000 : 5000,
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};
