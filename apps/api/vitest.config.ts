import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    sequence: { shuffle: false },
    include: ['test/flow.test.ts', 'test/sweeper.test.ts', 'test/zz-chain.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/loyalink_test',
      OTP_DEV_ECHO: 'true',
      CHAIN_MODE: 'off',
      ADMIN_PHONES: '+919999900000',
      WORKERS: 'false',
      APP_ORIGIN: 'http://localhost:5173',
      LOG_LEVEL: 'warn',
    },
  },
});
