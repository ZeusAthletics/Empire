import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

const TIER_RANK: Record<IntimacyTier, number> = {
  EARLY: 0,
  FRIEND: 1,
  TRUST: 2,
};

export function intimacyTierRank(tier: IntimacyTier): number {
  return TIER_RANK[tier];
}

/** Player at FRIEND may receive items tagged EARLY or FRIEND; TRUST unlocks all three. */
export function intimacyTierAtLeast(playerTier: IntimacyTier, requiredMin: IntimacyTier): boolean {
  return TIER_RANK[playerTier] >= TIER_RANK[requiredMin];
}

export function stricterIntimacyTier(a: IntimacyTier, b: IntimacyTier): IntimacyTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

export function isCuratedIntimacyBlockedReason(reason: string): boolean {
  return reason.includes("Band te laag voor dit item");
}

export const INTIMACY_TIER_LABELS: Record<IntimacyTier, string> = {
  EARLY: "Early — band opbouwen",
  FRIEND: "Friend — warmere band",
  TRUST: "Trust — diep vertrouwen",
};

export const INTIMACY_CATALOG_ACCESS_RULE = `Curated catalog (cumulatief): EARLY-band = alleen items met minTier EARLY. FRIEND = EARLY + FRIEND items. TRUST = EARLY + FRIEND + TRUST. Kies nooit een curatedMediaId buiten de CATALOGUS-lijst.`;
