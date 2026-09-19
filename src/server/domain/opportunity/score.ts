import type { StatKey } from "@/server/domain/player/types";
import type { OpportunityDraft, ScoreBreakdown, ScoreContext } from "@/server/domain/opportunity/types";

const ADJACENT: Record<StatKey, StatKey[]> = {
  capital: ["income", "ownership"],
  income: ["capital", "execution"],
  ownership: ["capital", "optionality"],
  network: ["authority", "optionality"],
  authority: ["network", "strategy"],
  strategy: ["authority", "optionality"],
  execution: ["income", "strategy"],
  optionality: ["network", "ownership", "strategy"],
};

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bottleneckFit(related: StatKey[], bottleneck: StatKey) {
  if (related.includes(bottleneck)) return 1;
  if (related.some((stat) => ADJACENT[bottleneck]?.includes(stat))) return 0.3;
  return 0;
}

export function proximityFit(
  item: { lat?: number | null; lng?: number | null; availableFrom?: string | null },
  agenda: ScoreContext["agenda"],
) {
  if (item.lat == null || item.lng == null || !agenda.length) return 0;
  const day = item.availableFrom ? new Date(item.availableFrom).toDateString() : null;
  const points = agenda.filter((point) => !day || new Date(point.at).toDateString() === day);
  const targets = points.length ? points : agenda;
  const nearest = Math.min(...targets.map((point) => haversineMeters({ lat: item.lat!, lng: item.lng! }, point)));
  if (nearest <= 5000) return 1;
  if (nearest >= 60000) return 0;
  return 1 - (nearest - 5000) / 55000;
}

export function timingFit(availableFrom: string | null | undefined, now = new Date()) {
  if (!availableFrom) return 0.5;
  const days = (new Date(availableFrom).getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 0;
  if (days < 1) return 0.4;
  if (days <= 14) return 1;
  if (days > 60) return 0.2;
  return 0.6;
}

export function relationshipFit(contactKeys: string[], known: string[]) {
  if (!contactKeys.length) return 0.2;
  const hits = contactKeys.filter((key) => known.includes(key)).length;
  return hits > 0 ? 1 : 0.15;
}

export function interestFit(weight: number) {
  const sigmoid = 1 / (1 + Math.exp(-(weight / 12)));
  return Math.max(0.15, Math.min(1, sigmoid));
}

export function noveltyInv(similarCount: number) {
  return Math.max(0.2, 1 - similarCount * 0.25);
}

export function clampAdjustment(value: number) {
  return Math.max(-15, Math.min(15, Math.round(value)));
}

export function applyScoreAdjustment(base: number, adjustment: number) {
  return Math.max(0, Math.min(100, Math.round(base + clampAdjustment(adjustment))));
}

export function scoreOpportunity(draft: OpportunityDraft, context: ScoreContext): ScoreBreakdown & { score: number } {
  const now = context.now ?? new Date();
  const expired = Boolean(draft.expiresAt && new Date(draft.expiresAt).getTime() < now.getTime());
  const restricted = (draft.relatedContactKeys ?? []).some((key) => context.restrictedContactKeys.includes(key));
  const dismissed = context.dismissedCategories.includes(draft.category);
  const hard = expired || restricted || dismissed ? 0 : 1;

  const parts = {
    bottleneckFit: bottleneckFit(draft.relatedStats, context.bottleneckStat),
    proximity: proximityFit(draft, context.agenda),
    timing: timingFit(draft.availableFrom, now),
    relationshipFit: relationshipFit(draft.relatedContactKeys ?? [], context.knownContactKeys),
    interestFit: interestFit(context.categoryWeight),
    noveltyPenaltyInv: noveltyInv(context.similarCount),
    hardFilters: hard,
  };
  const base = Math.round(
    100 *
      (0.35 * parts.bottleneckFit +
        0.2 * parts.proximity +
        0.15 * parts.timing +
        0.15 * parts.relationshipFit +
        0.1 * parts.interestFit +
        0.05 * parts.noveltyPenaltyInv) *
      parts.hardFilters,
  );
  return { ...parts, base, score: base };
}

const STAT_NL: Record<StatKey, string> = {
  capital: "Kapitaal",
  income: "Inkomen",
  ownership: "Ownership",
  network: "Netwerk",
  authority: "Authority",
  strategy: "Strategy",
  execution: "Execution",
  optionality: "Optionality",
};

export function defaultReasons(draft: OpportunityDraft, context: ScoreContext, breakdown: ScoreBreakdown) {
  const reasons: string[] = [];
  if (breakdown.bottleneckFit >= 1) {
    reasons.push(`${STAT_NL[context.bottleneckStat]} is uw huidige rem.`);
  } else if (breakdown.bottleneckFit > 0) {
    reasons.push(`${STAT_NL[context.bottleneckStat]} is de rem; ${STAT_NL[draft.relatedStats[0] ?? "network"]} ligt ernaast.`);
  }
  if (draft.locationName) {
    reasons.push(`${draft.locationName} ligt dicht bij waar u al moet zijn.`);
  }
  if ((draft.relatedContactKeys ?? []).length) {
    reasons.push("Bekende connectors zijn betrokken.");
  }
  if (!reasons.length) reasons.push("Handmatig toegevoegd. Score volgt de formule.");
  return reasons.slice(0, 3);
}
