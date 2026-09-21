import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stricterIntimacyTier } from "@/server/domain/nyx/curated/tier";
import { latestRelationshipSnapshot } from "@/server/domain/nyx/relationship/repository";

export type IntimacyTier = "EARLY" | "FRIEND" | "TRUST";

export async function computeIntimacyTier(playerId: string): Promise<IntimacyTier> {
  const admin = createSupabaseAdminClient();
  const { data: memories, error } = await admin
    .from("memories")
    .select("domain, importance")
    .eq("player_id", playerId)
    .eq("domain", "RELATIONSHIP")
    .eq("status", "ACTIVE");
  if (error) throw error;

  const relationshipCount = memories?.length ?? 0;
  const highCount = (memories ?? []).filter((row) => row.importance === "HIGH").length;

  const { count: messageCount, error: msgError } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "USER");
  if (msgError) throw msgError;

  const depth = messageCount ?? 0;
  if (highCount >= 2 || (relationshipCount >= 4 && depth >= 25)) return "TRUST";
  if (relationshipCount >= 2 || depth >= 12) return "FRIEND";
  return "EARLY";
}

/** Band for curated photos/videos: live compute, capped by latest relationship snapshot when present. */
export async function resolvePlayerIntimacyTier(playerId: string): Promise<IntimacyTier> {
  const [computed, snapshot] = await Promise.all([
    computeIntimacyTier(playerId),
    latestRelationshipSnapshot(playerId).catch(() => null),
  ]);
  const fromSnapshot = snapshot?.intimacyTier;
  if (!fromSnapshot) return computed;
  return stricterIntimacyTier(computed, fromSnapshot);
}
