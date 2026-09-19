import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityDraft,
  OpportunityKind,
  OpportunitySignalKind,
  OpportunitySource,
  OpportunityStatus,
} from "@/server/domain/opportunity/types";
import type { StatKey } from "@/server/domain/player/types";

const CATEGORIES = new Set<OpportunityCategory>([
  "EVENT",
  "PERSON",
  "COMPANY",
  "CONTENT",
  "PROPERTY",
  "ROLE",
  "DEAL",
  "OTHER",
]);

function asEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return allowed.has(value as T) ? (value as T) : fallback;
}

export function mapOpportunity(row: Record<string, unknown>): Opportunity {
  return {
    id: row.id as string,
    seedKey: (row.seed_key as string | null) ?? null,
    title: row.title as string,
    summary: row.summary as string,
    category: asEnum(row.category, CATEGORIES, "OTHER"),
    sourceType: (row.source_type as OpportunitySource) ?? "MANUAL",
    availableFrom: (row.available_from as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    locationName: (row.location_name as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    relevanceScore: Number(row.relevance_score ?? 0),
    baseScore: Number(row.base_score ?? 0),
    scoreAdjustment: Number(row.score_adjustment ?? 0),
    reasonsForRelevance: Array.isArray(row.reasons_for_relevance) ? (row.reasons_for_relevance as string[]) : [],
    relatedStats: Array.isArray(row.related_stats) ? (row.related_stats as StatKey[]) : [],
    relatedContactKeys: Array.isArray(row.related_contact_keys) ? (row.related_contact_keys as string[]) : [],
    type: (row.type as OpportunityKind) ?? "STRATEGIC",
    campaignChanging: Boolean(row.campaign_changing),
    status: (row.status as OpportunityStatus) ?? "NEW",
    scoreBreakdown: row.score_breakdown && typeof row.score_breakdown === "object"
      ? (row.score_breakdown as Opportunity["scoreBreakdown"])
      : null,
  };
}

export async function listAllOpportunities(playerId: string): Promise<Opportunity[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("opportunities")
    .select("*")
    .eq("player_id", playerId)
    .order("relevance_score", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>));
}

export async function listOpportunities(playerId: string): Promise<Opportunity[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("opportunities")
    .select("*")
    .eq("player_id", playerId)
    .in("status", ["NEW", "SEEN", "SAVED"])
    .order("relevance_score", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapOpportunity(row as Record<string, unknown>))
    .filter((item) => item.relevanceScore > 0);
}

export async function listLiveOpportunities(playerId: string): Promise<Opportunity[]> {
  const items = await listOpportunities(playerId);
  return items.filter((item) => item.relevanceScore >= 60).slice(0, 5);
}

export async function upsertOpportunity(
  playerId: string,
  draft: OpportunityDraft,
  scored: {
    base: number;
    score: number;
    adjustment: number;
    breakdown: Record<string, number>;
    reasons: string[];
  },
): Promise<Opportunity> {
  const admin = createSupabaseAdminClient();
  const fields = {
    player_id: playerId,
    seed_key: draft.seedKey ?? null,
    title: draft.title,
    summary: draft.summary,
    category: draft.category,
    source_type: draft.sourceType ?? "MANUAL",
    available_from: draft.availableFrom ?? null,
    expires_at: draft.expiresAt ?? null,
    location_name: draft.locationName ?? null,
    lat: draft.lat ?? null,
    lng: draft.lng ?? null,
    relevance_score: scored.score,
    base_score: scored.base,
    score_adjustment: scored.adjustment,
    score_breakdown: scored.breakdown,
    reasons_for_relevance: scored.reasons,
    related_stats: draft.relatedStats,
    related_contact_keys: draft.relatedContactKeys ?? [],
    type: draft.type ?? "STRATEGIC",
    campaign_changing: Boolean(draft.campaignChanging),
    strategic_value: draft.strategicValue ?? null,
    urgency: draft.urgency ?? null,
    status: scored.score === 0 ? "EXPIRED" : "NEW",
  };

  if (draft.seedKey) {
    const { data: existing, error: lookupError } = await admin
      .from("opportunities")
      .select("id, status")
      .eq("player_id", playerId)
      .eq("seed_key", draft.seedKey)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.status === "DISMISSED") {
      const { data } = await admin.from("opportunities").select("*").eq("id", existing.id).single();
      return mapOpportunity(data as Record<string, unknown>);
    }
    if (existing) {
      const { data, error } = await admin
        .from("opportunities")
        .update(fields as never)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error || !data) throw error ?? new Error("Opportunity kon niet worden bijgewerkt.");
      return mapOpportunity(data as Record<string, unknown>);
    }
  }

  const { data, error } = await admin.from("opportunities").insert(fields as never).select("*").single();
  if (error || !data) throw error ?? new Error("Opportunity kon niet worden bewaard.");
  return mapOpportunity(data as Record<string, unknown>);
}

export async function setOpportunityStatus(playerId: string, id: string, status: OpportunityStatus) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("opportunities")
    .update({ status } as never)
    .eq("id", id)
    .eq("player_id", playerId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Opportunity kon niet worden bijgewerkt.");
  return mapOpportunity(data as Record<string, unknown>);
}

export async function recordSignal(
  playerId: string,
  opportunityId: string,
  signal: OpportunitySignalKind,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("opportunity_signals").insert({
    player_id: playerId,
    opportunity_id: opportunityId,
    signal,
  } as never);
  if (error) throw error;
}

export async function categoryWeight(playerId: string, category: OpportunityCategory) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("opportunity_signals")
    .select("signal, opportunities!inner(category)")
    .eq("player_id", playerId);
  if (error) return 0;
  const WEIGHT: Record<string, number> = {
    SAVED: 3,
    CONVERTED: 5,
    COMPLETED: 8,
    VIEWED: 1,
    DISMISSED: -4,
    IGNORED: -1,
  };
  return (data ?? []).reduce((sum, row) => {
    const rel = row.opportunities as { category?: string } | { category?: string }[] | null;
    const cat = Array.isArray(rel) ? rel[0]?.category : rel?.category;
    if (cat !== category) return sum;
    return sum + (WEIGHT[row.signal as string] ?? 0);
  }, 0);
}

export async function countSimilar(playerId: string, title: string) {
  const admin = createSupabaseAdminClient();
  const token = title.trim().slice(0, 12);
  if (!token) return 0;
  const { data, error } = await admin
    .from("opportunities")
    .select("id, title")
    .eq("player_id", playerId)
    .ilike("title", `%${token}%`);
  if (error) return 0;
  return (data ?? []).length;
}
