import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROLLING_WEEK_MS } from "@/server/domain/nyx/checkIn/eligibility";

function isMissingColumn(error: { code?: string; message?: string }, column: string): boolean {
  if (error.code === "42703") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

export async function lastUserMessageAt(playerId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("created_at")
    .eq("player_id", playerId)
    .eq("role", "USER")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.created_at as string | undefined) ?? null;
}

export async function lastCheckInAt(playerId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("created_at")
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .eq("is_check_in", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error, "is_check_in")) return null;
    throw error;
  }
  return (data?.created_at as string | undefined) ?? null;
}

export async function countCheckInsLast7Days(playerId: string, now = new Date()): Promise<number> {
  const admin = createSupabaseAdminClient();
  const since = new Date(now.getTime() - ROLLING_WEEK_MS).toISOString();
  const { count, error } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .eq("is_check_in", true)
    .gte("created_at", since);
  if (error) {
    if (isMissingColumn(error, "is_check_in")) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function missionControlSilenceAnchor(playerId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: conv, error } = await admin
    .from("nyx_conversations")
    .select("started_at")
    .eq("player_id", playerId)
    .eq("mode", "MISSION_CONTROL")
    .is("deleted_at", null)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (conv?.started_at as string | undefined) ?? null;
}
