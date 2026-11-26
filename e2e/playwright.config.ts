import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const PORT = 8090;
const DB = process.env.E2E_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/loyalink_e2e';
const root = path.resolve(import.meta.dirname, '..');
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Pixel 7'] },
  webServer: {
    // Fresh schema every run, then the real server (migrations run on boot).
    command: `psql "${DB}" -q -c "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;" && pnpm --filter @loyallink/api exec tsx src/server.ts`,
    cwd: root,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test', PORT: String(PORT), APP_ORIGIN: `http://localhost:${PORT}`,
      DATABASE_URL: DB,
      OTP_DEV_ECHO: 'true', CHAIN_MODE: 'off', ADMIN_PHONES: '+919999911111', LOG_LEVEL: 'warn',
      WEB_DIST: path.join(root, 'apps/web/dist'),
    },
  },
});
