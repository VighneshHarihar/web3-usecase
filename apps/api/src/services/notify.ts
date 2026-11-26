import { and, eq, inArray, isNull } from 'drizzle-orm';
import { formatINR } from '@loyallink/shared';
import type { Executor } from '../db/index.js';
import { notifications, offers, merchants, users, waitlist } from '../db/schema.js';

export async function notify(
  tx: Executor,
  n: { userId: string; kind: string; title: string; body: string; link?: string; dedupeKey?: string },
) {
  await tx
    .insert(notifications)
    .values({ ...n, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null })
    .onConflictDoNothing({ target: notifications.dedupeKey });
}

/** When pool capacity returns, tell waitlisted customers (first to tap gets the spot). */
export async function notifyWaitlist(tx: Executor, merchantId: string) {
  const [m] = await tx.select().from(merchants).where(eq(merchants.id, merchantId));
  if (!m || m.frozen) return;
  const live = await tx.select().from(offers).where(and(eq(offers.merchantId, merchantId), eq(offers.status, 'live')));
  for (const o of live) {
    const capacity = Math.min(Math.floor(m.available / o.rewardValue), o.maxEnrolments - o.enrolled);
    if (capacity <= 0) continue;
    const waiting = await tx
      .select({ userId: waitlist.userId, locale: users.locale })
      .from(waitlist)
      .innerJoin(users, eq(users.id, waitlist.userId))
      .where(and(eq(waitlist.offerId, o.id), isNull(waitlist.notifiedAt)))
      .orderBy(waitlist.createdAt)
      .limit(capacity * 3);
    for (const w of waiting) {
      await notify(tx, {
        userId: w.userId,
        kind: 'waitlist',
        title: w.locale === 'hi' ? `${m.name} में जगह खुली है` : `A spot opened at ${m.name}`,
        body: w.locale === 'hi' ? `"${o.title}" में शामिल होने के लिए टैप करें।` : `Tap to join "${o.title}" (${formatINR(o.rewardValue)} reward).`,
        link: `/offer/${o.id}`,
        dedupeKey: `waitlist:${o.id}:${w.userId}:${Date.now()}`,
      });
    }
    if (waiting.length)
      await tx
        .update(waitlist)
        .set({ notifiedAt: new Date() })
        .where(and(eq(waitlist.offerId, o.id), inArray(waitlist.userId, waiting.map((w) => w.userId))));
  }
}
