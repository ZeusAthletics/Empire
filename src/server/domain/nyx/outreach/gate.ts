import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

export async function lastOutreachSendAt(playerId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_outreach_runs")
    .select("created_at")
    .eq("player_id", playerId)
    .neq("action", "SILENCE")
    .not("reason", "like", "Admin test%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.created_at as string | undefined) ?? null;
}

export async function outreachFloorHours(playerId: string): Promise<number> {
  const last = await lastOutreachSendAt(playerId);
  if (!last) return 0;
  const seed = playerId.charCodeAt(0) + playerId.charCodeAt(1);
  const minH = 18 + (seed % 5);
  const maxH = 34 + (seed % 7);
  const floor = minH + ((seed * 7) % (maxH - minH + 1));
  const elapsed = hoursSince(last);
  return Math.max(0, floor - elapsed);
}

/** Returns false when we should skip calling the model entirely this tick. */
export async function shouldWakeOutreachDecision(playerId: string, intimacy: IntimacyTier): Promise<boolean> {
  const floorRemaining = await outreachFloorHours(playerId);
  if (floorRemaining > 0) return false;

  const last = await lastOutreachSendAt(playerId);
  const hours = last ? hoursSince(last) : 999;

  let base = 0.08;
  if (intimacy === "FRIEND") base = 0.12;
  if (intimacy === "TRUST") base = 0.16;
  if (hours > 72) base += 0.06;
  if (hours > 120) base += 0.04;

  const jitter = Math.random();
  return jitter < base;
}
