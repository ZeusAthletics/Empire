import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyScoreAdjustment,
  clampAdjustment,
  defaultReasons,
  scoreOpportunity,
} from "@/server/domain/opportunity/score";
import {
  categoryWeight,
  countSimilar,
  listLiveOpportunities,
  listOpportunities,
  recordSignal,
  setOpportunityStatus,
  upsertOpportunity,
} from "@/server/domain/opportunity/repository";
import type { OpportunityDraft, ScoreContext } from "@/server/domain/opportunity/types";

export function planOpportunityAnalysis(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "OPPORTUNITY_ANALYSIS", risk });
}

export function planOpportunityPrefilter() {
  return planNyxTask({ task: "OPPORTUNITY_PREFILTER" });
}

export function planOpportunityRanking() {
  return planNyxTask({ task: "OPPORTUNITY_RANKING" });
}

export function planAcquisitionOpportunity() {
  return planOpportunityAnalysis({
    campaignChanging: true,
    strategicImpact: 0.95,
    irreversibility: 0.95,
  });
}

export function prefilterManual(draft: OpportunityDraft) {
  const expired = Boolean(draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now());
  const campaignChanging = Boolean(draft.campaignChanging);
  return {
    relevant: !expired,
    campaignChanging,
    category: draft.category,
    reason: expired ? "Verlopen." : "Handmatige bron.",
  };
}

async function buildScoreContext(playerId: string, draft: OpportunityDraft): Promise<ScoreContext> {
  const campaign = await findPublicCampaignByPlayerId(playerId).catch(() => null);
  const admin = createSupabaseAdminClient();
  const { data: contacts } = await admin
    .from("contacts")
    .select("seed_key, restricted")
    .eq("player_id", playerId)
    .is("deleted_at", null);
  const known = (contacts ?? [])
    .filter((row) => !row.restricted && row.seed_key)
    .map((row) => row.seed_key as string);
  const restricted = (contacts ?? [])
    .filter((row) => row.restricted && row.seed_key)
    .map((row) => row.seed_key as string);
  const agenda =
    draft.lat != null && draft.lng != null && draft.availableFrom
      ? [{ lat: draft.lat, lng: draft.lng, at: draft.availableFrom }]
      : [];
  return {
    bottleneckStat: campaign?.bottleneckStat ?? "optionality",
    agenda,
    knownContactKeys: known,
    restrictedContactKeys: restricted,
    dismissedCategories: [],
    categoryWeight: await categoryWeight(playerId, draft.category).catch(() => 0),
    similarCount: await countSimilar(playerId, draft.title).catch(() => 0),
  };
}

/** Two-stage rank. Never creates a mission. */
export async function ingestOpportunity(playerId: string, draft: OpportunityDraft, adjustment = 0) {
  const prefilter = prefilterManual(draft);
  const context = await buildScoreContext(playerId, draft);
  const breakdown = scoreOpportunity(draft, context);
  if (!prefilter.relevant && breakdown.hardFilters === 1) {
    return { opportunity: null, createdMission: null, breakdown };
  }
  const score = applyScoreAdjustment(breakdown.score, adjustment);
  const reasons = defaultReasons(draft, context, breakdown);
  if (draft.relatedStats.includes("network") && !reasons.some((reason) => /netwerk/i.test(reason))) {
    reasons.unshift("Netwerk is de rem. Dit event ligt in Geel, bij connectors die u al kent.");
  }
  const opportunity = await upsertOpportunity(playerId, draft, {
    base: breakdown.base,
    score,
    adjustment: clampAdjustment(adjustment),
    breakdown: {
      bottleneckFit: breakdown.bottleneckFit,
      proximity: breakdown.proximity,
      timing: breakdown.timing,
      relationshipFit: breakdown.relationshipFit,
      interestFit: breakdown.interestFit,
      noveltyPenaltyInv: breakdown.noveltyPenaltyInv,
      hardFilters: breakdown.hardFilters,
    },
    reasons,
  });
  return { opportunity, createdMission: null, breakdown };
}

export async function getRadar(playerId: string) {
  const items = await listOpportunities(playerId);
  return { items, createdMission: null };
}

export async function saveOpportunity(playerId: string, id: string) {
  const item = await setOpportunityStatus(playerId, id, "SAVED");
  await recordSignal(playerId, id, "SAVED");
  return { item, createdMission: null };
}

export async function dismissOpportunity(playerId: string, id: string) {
  const item = await setOpportunityStatus(playerId, id, "DISMISSED");
  await recordSignal(playerId, id, "DISMISSED");
  return { item, createdMission: null };
}

export async function runRadarJob(playerId: string) {
  const live = await listLiveOpportunities(playerId).catch((): Awaited<ReturnType<typeof listLiveOpportunities>> => []);
  return { count: live.length, createdMission: null };
}
