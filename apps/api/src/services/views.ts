/** Response shapes shared by routes. Never leaks phone numbers or internal balances to customers. */
import { describeCondition, describeReward, maskPhone, progress, shortRef } from '@loyallink/shared';
import type { Enrolment, Merchant, Offer, Reward } from '../db/schema.js';
import { termsOf } from './escrow.js';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const shopView = (m: Merchant) => ({
  id: m.id, slug: m.slug, name: m.name, category: m.category, description: m.description,
  address: m.address, city: m.city, lat: m.lat, lng: m.lng, verified: m.status === 'approved', frozen: m.frozen,
});

export function spotsLeft(o: Offer, m: Merchant) {
  return Math.max(0, Math.min(o.maxEnrolments - o.enrolled, Math.floor(m.available / o.rewardValue)));
}

export function offerView(o: Offer, m: Merchant, origin?: { lat: number; lng: number }) {
  const t = termsOf(o);
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status,
    terms: t,
    text: {
      en: { condition: describeCondition(t, 'en'), reward: describeReward(t, 'en') },
      hi: { condition: describeCondition(t, 'hi'), reward: describeReward(t, 'hi') },
    },
    feeBps: o.feeBps,
    termsHash: o.termsHash,
    spotsLeft: spotsLeft(o, m),
    /** The reward for the next customer is already in the pool (R1). */
    secured: m.available >= o.rewardValue && !m.frozen,
    publishedAt: o.publishedAt,
    shop: shopView(m),
    distanceKm: origin && m.lat != null && m.lng != null ? Math.round(haversineKm(origin.lat, origin.lng, m.lat, m.lng) * 10) / 10 : null,
  };
}

export function enrolmentView(e: Enrolment, o: Offer, m: Merchant) {
  const p = progress(termsOf(o), e.purchases, e.spend);
  return {
    id: e.id, status: e.status, purchases: e.purchases, spend: e.spend, startedAt: e.startedAt, deadline: e.deadline,
    closedAt: e.closedAt, rewardId: e.rewardId, progress: p, reserved: o.rewardValue,
    offer: offerView(o, m),
  };
}

export function rewardView(r: Reward, m: Merchant, o?: Offer) {
  return {
    id: r.id, kind: r.kind, percentBps: r.percentBps, value: r.value, remaining: r.remaining, status: r.status,
    issuedAt: r.issuedAt, expiresAt: r.expiresAt, offerTitle: o?.title ?? null,
    text: { en: describeReward({ rewardKind: r.kind as 'credit' | 'percent', rewardValue: r.value, percentBps: r.percentBps }, 'en'), hi: describeReward({ rewardKind: r.kind as 'credit' | 'percent', rewardValue: r.value, percentBps: r.percentBps }, 'hi') },
    shop: shopView(m),
  };
}

/** What merchant staff see about a customer: first name + last 4 digits only (docs/09). */
export function customerCard(u: { id: string; name: string | null; phone: string }) {
  return { ref: shortRef(u.id), name: u.name?.split(' ')[0] ?? null, phone: u.phone.startsWith('deleted:') ? '' : maskPhone(u.phone) };
}
