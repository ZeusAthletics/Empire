import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function countUnseenNyxMedia(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .not("media_id", "is", null)
    .is("seen_at", null);
  if (error) {
    if (error.code === "42703") return 0;
    throw error;
  }
  return count ?? 0;
}

export async function markNyxMediaSeen(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("nyx_messages")
    .update({ seen_at: now } as never)
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .not("media_id", "is", null)
    .is("seen_at", null)
    .select("id");
  if (error) {
    if (error.code === "42703") return 0;
    throw error;
  }
  return data?.length ?? 0;
}
