import type { OfferTerms } from '@loyallink/shared/core';

export interface Me {
  user: { id: string; phone: string; name: string | null; locale: 'en' | 'hi'; isAdmin: boolean };
  memberships: { merchantId: string; name: string; slug: string; status: string; role: 'owner' | 'staff' }[];
}

export interface Shop {
  id: string; slug: string; name: string; category: string; description: string; address: string; city: string;
  lat: number | null; lng: number | null; verified: boolean; frozen: boolean;
}

export interface OfferCard {
  id: string; title: string; description: string; status: string; terms: OfferTerms;
  text: Record<'en' | 'hi', { condition: string; reward: string }>;
  feeBps: number; termsHash: string | null; spotsLeft: number; secured: boolean; publishedAt: string | null;
  shop: Shop; distanceKm: number | null; stats?: Record<string, number>;
}

export interface EnrolmentV {
  id: string; status: string; purchases: number; spend: number; startedAt: string; deadline: string; closedAt: string | null;
  rewardId: string | null; reserved: number;
  progress: { purchases: number; spend: number; overall: number; purchasesLeft: number; spendLeft: number };
  offer: OfferCard;
}

export interface RewardV {
  id: string; kind: 'credit' | 'percent'; percentBps: number; value: number; remaining: number; status: string;
  issuedAt: string; expiresAt: string; offerTitle: string | null; text: Record<'en' | 'hi', string>; shop: Shop;
}

export interface MerchantV {
  id: string; slug: string; name: string; category: string; description: string; address: string; city: string;
  lat: number | null; lng: number | null; phone: string | null; gstin: string | null; pan: string | null; upiId: string;
  status: 'pending' | 'approved' | 'rejected'; rejectionReason: string | null; frozen: boolean; plan: 'free' | 'pro';
  planRenewsAt: string | null; available: number; committed: number; owed: number; role?: string;
  limits: { liveOffers: number | null; poolCap: number | null; staff: number; csvExport: boolean };
}
