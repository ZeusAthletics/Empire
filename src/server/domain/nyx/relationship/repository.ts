import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export type RelationshipSnapshot = {
  id: string;
  playerId: string;
  trustScore: number;
  warmthScore: number;
  tensionScore: number;
  intimacyTier: IntimacyTier | null;
  headline: string;
  analysis: string;
  highlights: string[];
  concerns: string[];
  runId: string | null;
  createdAt: string;
};

function isMissingSnapshotTable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("nyx_relationship_snapshots") &&
    (msg.includes("does not exist") || msg.includes("could not find"))
  );
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mapSnapshot(row: Record<string, unknown>): RelationshipSnapshot {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    trustScore: Number(row.trust_score) || 0,
    warmthScore: Number(row.warmth_score) || 0,
    tensionScore: Number(row.tension_score) || 0,
    intimacyTier: (row.intimacy_tier as IntimacyTier | null) ?? null,
    headline: (row.headline as string) ?? "",
    analysis: (row.analysis as string) ?? "",
    highlights: asStringList(row.highlights),
    concerns: asStringList(row.concerns),
    runId: (row.run_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function insertRelationshipSnapshot(input: {
  playerId: string;
  trustScore: number;
  warmthScore: number;
  tensionScore: number;
  intimacyTier: IntimacyTier | null;
  headline: string;
  analysis: string;
  highlights: string[];
  concerns: string[];
  runId?: string | null;
}): Promise<RelationshipSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_relationship_snapshots")
    .insert({
      player_id: input.playerId,
      trust_score: clampScore(input.trustScore),
      warmth_score: clampScore(input.warmthScore),
      tension_score: clampScore(input.tensionScore),
      intimacy_tier: input.intimacyTier,
      headline: input.headline.trim(),
      analysis: input.analysis.trim(),
      highlights: input.highlights,
      concerns: input.concerns,
      run_id: input.runId ?? null,
    } as never)
    .select("*")
    .single();
  if (error) {
    if (isMissingSnapshotTable(error)) {
      throw new Error("Database-migratie ontbreekt: voer 20260921120000_nyx_relationship.sql uit in Supabase.");
    }
    throw error;
  }
  return mapSnapshot(data as Record<string, unknown>);
}

export async function latestRelationshipSnapshot(playerId: string): Promise<RelationshipSnapshot | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_relationship_snapshots")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSnapshotTable(error)) return null;
    throw error;
  }
  return data ? mapSnapshot(data as Record<string, unknown>) : null;
}

export async function listRelationshipSnapshots(playerId: string, limit = 12): Promise<RelationshipSnapshot[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_relationship_snapshots")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingSnapshotTable(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapSnapshot(row as Record<string, unknown>));
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
