import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PatternConfidence,
  PatternEvidenceRef,
  PatternImpact,
  PatternProposalPayload,
  PatternStatus,
  StrategicPattern,
} from "@/server/domain/pattern/types";
import type { StatKey } from "@/server/domain/player/types";

const IMPACTS = new Set<PatternImpact>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const STATUSES = new Set<PatternStatus>(["OBSERVING", "SURFACED", "CONFIRMED", "DISMISSED", "RESOLVED"]);
const CONFIDENCE = new Set<PatternConfidence>(["TENTATIVE", "LIKELY", "CONFIRMED", "EXPLICIT"]);

function asEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return allowed.has(value as T) ? (value as T) : fallback;
}

function asRefs(value: unknown): PatternEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as PatternEvidenceRef;
      if (!row.type || !row.id || !row.at) return null;
      return { type: row.type, id: String(row.id), at: String(row.at) };
    })
    .filter((item): item is PatternEvidenceRef => Boolean(item));
}

export function mapPattern(row: Record<string, unknown>): StrategicPattern {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    seedKey: (row.seed_key as string | null) ?? null,
    title: row.title as string,
    description: row.description as string,
    evidenceRefs: asRefs(row.evidence_refs),
    firstDetectedAt: row.first_detected_at as string,
    lastDetectedAt: row.last_detected_at as string,
    confidence: asEnum(row.confidence, CONFIDENCE, "LIKELY"),
    strategicImpact: asEnum(row.strategic_impact, IMPACTS, "MEDIUM"),
    relatedStats: Array.isArray(row.related_stats) ? (row.related_stats as StatKey[]) : [],
    relatedMemoryIds: Array.isArray(row.related_memory_ids) ? (row.related_memory_ids as string[]) : [],
    status: asEnum(row.status, STATUSES, "OBSERVING"),
    surfacedAt: (row.surfaced_at as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
  };
}

export async function listPatterns(playerId: string): Promise<StrategicPattern[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("strategic_patterns")
    .select("*")
    .eq("player_id", playerId)
    .order("last_detected_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapPattern(row as Record<string, unknown>));
}

export async function listOpenPatterns(playerId: string): Promise<StrategicPattern[]> {
  const patterns = await listPatterns(playerId);
  return patterns.filter((pattern) => pattern.status === "SURFACED" || pattern.status === "CONFIRMED");
}

export async function upsertPattern(
  playerId: string,
  input: {
    seedKey?: string | null;
    title: string;
    description: string;
    evidenceRefs: PatternEvidenceRef[];
    confidence?: PatternConfidence;
    strategicImpact: PatternImpact;
    relatedStats: StatKey[];
    relatedMemoryIds?: string[];
    status: PatternStatus;
  },
): Promise<StrategicPattern> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const fields = {
    player_id: playerId,
    seed_key: input.seedKey ?? null,
    title: input.title,
    description: input.description,
    evidence_refs: input.evidenceRefs,
    last_detected_at: now,
    confidence: input.confidence ?? "LIKELY",
    strategic_impact: input.strategicImpact,
    related_stats: input.relatedStats,
    related_memory_ids: input.relatedMemoryIds ?? [],
    status: input.status,
    surfaced_at: input.status === "SURFACED" ? now : null,
  };

  if (input.seedKey) {
    const { data: existing, error: lookupError } = await admin
      .from("strategic_patterns")
      .select("id, status")
      .eq("player_id", playerId)
      .eq("seed_key", input.seedKey)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && (existing.status === "CONFIRMED" || existing.status === "DISMISSED" || existing.status === "RESOLVED")) {
      const { data } = await admin.from("strategic_patterns").select("*").eq("id", existing.id).single();
      return mapPattern(data as Record<string, unknown>);
    }
    if (existing) {
      const { data, error } = await admin
        .from("strategic_patterns")
        .update(fields as never)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error || !data) throw error ?? new Error("Patroon kon niet worden bijgewerkt.");
      return mapPattern(data as Record<string, unknown>);
    }
  }

  const { data, error } = await admin.from("strategic_patterns").insert(fields as never).select("*").single();
  if (error || !data) throw error ?? new Error("Patroon kon niet worden bewaard.");
  return mapPattern(data as Record<string, unknown>);
}

export async function confirmPattern(playerId: string, patternId: string): Promise<StrategicPattern> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("strategic_patterns")
    .update({ status: "CONFIRMED", confirmed_at: new Date().toISOString() } as never)
    .eq("id", patternId)
    .eq("player_id", playerId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Patroon kon niet worden bevestigd.");
  return mapPattern(data as Record<string, unknown>);
}

export async function dismissPattern(playerId: string, patternId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("strategic_patterns")
    .update({ status: "DISMISSED" } as never)
    .eq("id", patternId)
    .eq("player_id", playerId);
  if (error) throw error;
}

export function patternProposalFrom(pattern: StrategicPattern): PatternProposalPayload {
  return {
    title: pattern.title,
    description: pattern.description,
    evidenceRefs: pattern.evidenceRefs,
    strategicImpact: pattern.strategicImpact,
    relatedStats: pattern.relatedStats,
    patternId: pattern.id,
  };
}
