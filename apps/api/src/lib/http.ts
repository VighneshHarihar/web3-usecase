import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { merchantMembers, merchants, type Merchant, type User } from '../db/schema.js';
import { badRequest, forbidden, notFound, unauthorized } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    sessionToken?: string;
  }
}

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest('VALIDATION', issues[0] ? `${issues[0].path ? issues[0].path + ': ' : ''}${issues[0].message}` : 'Invalid input', issues);
  }
  return r.data;
}

export function requireUser(req: FastifyRequest): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireAdmin(req: FastifyRequest): User {
  const u = requireUser(req);
  if (!u.isAdmin) throw forbidden();
  return u;
}

export async function requireMember(req: FastifyRequest, merchantId: string, role?: 'owner') {
  const u = requireUser(req);
  if (!/^[0-9a-f-]{36}$/i.test(merchantId)) throw notFound('Shop not found');
  const [row] = await db
    .select({ m: merchants, role: merchantMembers.role })
    .from(merchantMembers)
    .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
    .where(and(eq(merchantMembers.merchantId, merchantId), eq(merchantMembers.userId, u.id)));
  if (!row) {
    if (u.isAdmin) {
      const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
      if (m && !role) return { user: u, merchant: m as Merchant, role: 'admin' as const };
    }
    throw forbidden('You are not a member of this shop');
  }
  if (role === 'owner' && row.role !== 'owner') throw forbidden('Only the shop owner can do this');
  return { user: u, merchant: row.m, role: row.role as 'owner' | 'staff' };
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function uuidParam(v: string, what = 'Not found') {
  if (!isUuid(v)) throw notFound(what);
  return v;
}

export function sendCsv(reply: FastifyReply, filename: string, rows: Record<string, unknown>[]) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${filename}"`).send(body);
}
