import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

const TIER_RANK: Record<IntimacyTier, number> = {
  EARLY: 0,
  FRIEND: 1,
  TRUST: 2,
};

export function intimacyTierAtLeast(playerTier: IntimacyTier, requiredMin: IntimacyTier): boolean {
  return TIER_RANK[playerTier] >= TIER_RANK[requiredMin];
}

export const INTIMACY_TIER_LABELS: Record<IntimacyTier, string> = {
  EARLY: "Early — band opbouwen",
  FRIEND: "Friend — warmere band",
  TRUST: "Trust — diep vertrouwen",
};
