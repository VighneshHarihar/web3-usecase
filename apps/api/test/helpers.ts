import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';

let app: FastifyInstance | null = null;
export async function getApp() {
  if (!app) {
    await runMigrations();
    app = await buildApp({ logger: false });
  }
  return app;
}

let phoneSeq = 0;
export const newPhone = () => `+9198${String(Date.now() % 1e6).padStart(6, '0')}${String(++phoneSeq).padStart(2, '0')}`.slice(0, 13);

export interface Client {
  cookie: string;
  userId: string;
  get: (url: string) => Promise<{ status: number; body: any }>;
  post: (url: string, body?: unknown) => Promise<{ status: number; body: any }>;
  patch: (url: string, body?: unknown) => Promise<{ status: number; body: any }>;
  del: (url: string) => Promise<{ status: number; body: any }>;
}

export async function login(phone = newPhone(), name?: string): Promise<Client> {
  const a = await getApp();
  const r1 = await a.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  if (r1.statusCode !== 200) throw new Error(`otp request failed: ${r1.body}`);
  const code = r1.json().devCode;
  const r2 = await a.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  if (r2.statusCode !== 200) throw new Error(`otp verify failed: ${r2.body}`);
  const setCookie = r2.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(';')[0];
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) => {
    const r = await a.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
    let body: any = r.body;
    try { body = r.json(); } catch { /* csv etc */ }
    return { status: r.statusCode, body };
  };
  const c: Client = {
    cookie, userId: r2.json().user.id,
    get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), patch: (u, b) => call('PATCH', u, b ?? {}), del: (u) => call('DELETE', u),
  };
  if (name) await c.patch('/api/me', { name });
  return c;
}

export const shopInput = (over: Record<string, unknown> = {}) => ({
  name: 'Sharma General Store', category: 'grocery', address: '12 FC Road, Shivajinagar', city: 'Pune',
  lat: 18.5204, lng: 73.8567, upiId: 'sharma@okaxis', gstin: '27ABCDE1234F1Z5', ...over,
});

export const sharmaOffer = (over: Record<string, unknown> = {}) => ({
  title: '3 visits → 20% off', description: 'Thank you for shopping local',
  minPurchases: 3, minTotalSpend: 150_000, minPurchaseAmount: 20_000, windowDays: 30,
  rewardKind: 'percent', rewardValue: 30_000, percentBps: 2000, rewardValidityDays: 60, maxEnrolments: 100, perCustomerLimit: 1,
  ...over,
});

let adminClient: Client | null = null;
/** Onboard + approve + fund + publish. Returns ids and clients. */
export async function setupShop(opts: { fund?: number; offer?: Record<string, unknown> } = {}) {
  adminClient ??= await login('+919999900000', 'Priya');
  const admin = adminClient;
  const owner = await login(undefined, 'Rohan');
  const r = await owner.post('/api/merchants', shopInput());
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  const mid = r.body.merchant.id as string;
  await admin.post(`/api/admin/merchants/${mid}/approve`);
  if (opts.fund) {
    const p = await owner.post(`/api/m/${mid}/pool/topup`, { amount: opts.fund });
    if (p.status !== 200) throw new Error(JSON.stringify(p.body));
    await owner.post(`/api/payments/${p.body.payment.id}/confirm`, { simulate: 'success' });
  }
  const o = await owner.post(`/api/m/${mid}/offers`, sharmaOffer(opts.offer));
  if (o.status !== 200) throw new Error(JSON.stringify(o.body));
  const oid = o.body.offer.id as string;
  const pub = await owner.post(`/api/m/${mid}/offers/${oid}/publish`);
  if (pub.status !== 200) throw new Error(JSON.stringify(pub.body));
  return { admin, owner, mid, oid };
}

export async function scanCustomer(owner: Client, mid: string, customer: Client) {
  const pr = await customer.post('/api/c/presence');
  const lk = await owner.post(`/api/m/${mid}/counter/lookup`, { code: pr.body.qr });
  if (lk.status !== 200) throw new Error(JSON.stringify(lk.body));
  return lk.body as { sessionId: string; enrolments: any[]; rewards: any[] };
}
