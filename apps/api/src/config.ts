import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://postgres@127.0.0.1:5432/loyalink'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-change-me'),
  CUSTOMER_REF_SECRET: z.string().min(16).default('dev-customer-ref-secret-change-me'),
  OTP_DEV_ECHO: bool,
  SMS_PROVIDER: z.enum(['console', 'webhook']).default('console'),
  SMS_WEBHOOK_URL: z.string().optional(),
  SMS_WEBHOOK_TOKEN: z.string().optional(),
  ADMIN_PHONES: z.string().default(''),
  PAYMENTS_PROVIDER: z.enum(['sandbox', 'razorpay']).default('sandbox'),
  ALLOW_SANDBOX_PAYMENTS: bool,
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CHAIN_MODE: z.enum(['off', 'local', 'rpc']).default('off'),
  RPC_URL: z.string().default('http://127.0.0.1:8545'),
  CHAIN_ID: z.coerce.number().default(31337),
  CHAIN_NAME: z.string().default('Local dev chain'),
  EXPLORER_URL: z.string().default(''),
  /** Hardhat account #0 (public, well-known test key). NEVER use in production. */
  OPERATOR_PRIVATE_KEY: z.string().default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  ESCROW_ADDRESS: z.string().optional(),
  TOKEN_ADDRESS: z.string().optional(),
  FEE_BPS: z.coerce.number().int().min(0).max(300).default(200),
  WORKERS: z.string().default('true').transform((v) => v !== 'false'),
  RELAYER_INTERVAL_MS: z.coerce.number().default(2000),
  SWEEPER_INTERVAL_MS: z.coerce.number().default(30_000),
  WEB_DIST: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = schema.parse(env);
  if (c.NODE_ENV === 'production') {
    if (c.SESSION_SECRET.startsWith('dev-') || c.CUSTOMER_REF_SECRET.startsWith('dev-'))
      throw new Error('Set SESSION_SECRET and CUSTOMER_REF_SECRET in production');
    if (c.OTP_DEV_ECHO) throw new Error('OTP_DEV_ECHO must be off in production');
    if (c.PAYMENTS_PROVIDER === 'sandbox' && !c.ALLOW_SANDBOX_PAYMENTS)
      throw new Error('Sandbox payments are disabled in production (set ALLOW_SANDBOX_PAYMENTS=true for a demo)');
    if (c.CHAIN_MODE === 'rpc' && c.OPERATOR_PRIVATE_KEY.startsWith('0xac0974'))
      throw new Error('Set OPERATOR_PRIVATE_KEY in production');
  }
  return c;
}

export const config = loadConfig();
export const adminPhones = () => config.ADMIN_PHONES.split(',').map((s) => s.trim()).filter(Boolean);
