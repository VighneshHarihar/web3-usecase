/**
 * Demo data so the app is explorable on first run (idempotent).
 *   Admin     +91 99999 00000
 *   Merchant  +91 98000 00001 (Rohan: owns 4 shops)
 *   Customer  +91 98000 00002 (Asha: one offer in progress)
 * With OTP_DEV_ECHO=true the login code is shown on screen.
 */
import { eq } from 'drizzle-orm';
import { db, pool } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { merchantMembers, merchants, offers, users } from './db/schema.js';
import { findOrCreateUser } from './services/auth.js';
import { depositToPool, joinOffer, publishOffer, recordVisit } from './services/escrow.js';
import { appendLedger } from './services/ledger.js';

const SHOPS = [
  {
    slug: 'sharma-general-store', name: 'Sharma General Store', category: 'grocery', city: 'Pune', address: '14 FC Road, Shivajinagar', lat: 18.5236, lng: 73.8478,
    description: 'Groceries, dairy and daily needs since 1987.', fund: 2_000_000,
    offer: { title: 'Monthly regulars: 20% off', description: 'Three shopping trips this month and your next bill is 20% lighter.', minPurchases: 3, minTotalSpend: 150_000, minPurchaseAmount: 20_000, windowDays: 30, rewardKind: 'percent', rewardValue: 30_000, percentBps: 2000, rewardValidityDays: 60, maxEnrolments: 60, perCustomerLimit: 3 },
  },
  {
    slug: 'forno-pizza', name: 'Forno Pizza', category: 'food', city: 'Pune', address: 'Lane 6, Koregaon Park', lat: 18.5362, lng: 73.8940,
    description: 'Wood-fired pizza, made to order.', fund: 900_000,
    offer: { title: '3 large pizzas → ₹450 back', description: 'Stack three large pizzas in two weeks and get ₹450 off.', minPurchases: 3, minTotalSpend: 0, minPurchaseAmount: 45_000, windowDays: 14, rewardKind: 'credit', rewardValue: 45_000, percentBps: 0, rewardValidityDays: 45, maxEnrolments: 20, perCustomerLimit: 2 },
  },
  {
    slug: 'blueprint-coffee', name: 'Blueprint Coffee', category: 'coffee', city: 'Pune', address: 'Baner Road, Baner', lat: 18.5590, lng: 73.7868,
    description: 'Single-origin roasters.', fund: 600_000,
    offer: { title: '5 visits → ₹200 off', description: 'A latte habit that pays you back. No punch card to lose.', minPurchases: 5, minTotalSpend: 0, minPurchaseAmount: 15_000, windowDays: 30, rewardKind: 'credit', rewardValue: 20_000, percentBps: 0, rewardValidityDays: 60, maxEnrolments: 30, perCustomerLimit: 5 },
  },
  {
    slug: 'bakehouse-47', name: 'Bakehouse 47', category: 'bakery', city: 'Pune', address: 'Prabhat Road, Erandwane', lat: 18.5122, lng: 73.8336,
    description: 'Sourdough, pav and cardamom buns.', fund: 40_000,
    offer: { title: 'Spend ₹2,000 → 15% off', description: 'Every rupee counts toward your reward.', minPurchases: 1, minTotalSpend: 200_000, minPurchaseAmount: 0, windowDays: 60, rewardKind: 'percent', rewardValue: 40_000, percentBps: 1500, rewardValidityDays: 60, maxEnrolments: 10, perCustomerLimit: 1 },
  },
] as const;

async function main() {
  await runMigrations();
  const { user: admin } = await findOrCreateUser('+919999900000');
  await db.update(users).set({ name: 'Priya (LoyalLink ops)', isAdmin: true }).where(eq(users.id, admin.id));
  const { user: rohan } = await findOrCreateUser('+919800000001');
  await db.update(users).set({ name: 'Rohan' }).where(eq(users.id, rohan.id));
  const { user: asha } = await findOrCreateUser('+919800000002');
  await db.update(users).set({ name: 'Asha', locale: 'hi' }).where(eq(users.id, asha.id));

  for (const s of SHOPS) {
    const [exists] = await db.select().from(merchants).where(eq(merchants.slug, s.slug));
    if (exists) continue;
    await db.transaction(async (tx) => {
      const [m] = await tx.insert(merchants).values({
        slug: s.slug, name: s.name, category: s.category, city: s.city, address: s.address, lat: s.lat, lng: s.lng,
        description: s.description, upiId: `${s.slug.split('-')[0]}@upi`, phone: rohan.phone, status: 'approved', approvedAt: new Date(),
        plan: 'pro', planRenewsAt: new Date(Date.now() + 30 * 86_400_000),
      }).returning();
      await tx.insert(merchantMembers).values({ merchantId: m.id, userId: rohan.id, role: 'owner' });
      await appendLedger(tx, 'merchant.registered', { merchantId: m.id }, { subjectId: m.id, merchantId: m.id });
      await depositToPool(tx, m.id, s.fund, m.id);
      const [o] = await tx.insert(offers).values({ ...s.offer, merchantId: m.id }).returning();
      await publishOffer(tx, o.id);
      if (s.slug === 'sharma-general-store') {
        await joinOffer(tx, asha.id, o.id, new Date(Date.now() - 9 * 86_400_000));
        await recordVisit(tx, m.id, asha.id, rohan.id, 62_000, new Date(Date.now() - 8 * 86_400_000));
        await recordVisit(tx, m.id, asha.id, rohan.id, 48_500, new Date(Date.now() - 2 * 86_400_000));
      }
    });
    console.log('seeded', s.name);
  }
  console.log('\nDemo logins: admin +91 99999 00000 · shop owner +91 98000 00001 · customer +91 98000 00002');
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
