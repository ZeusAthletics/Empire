import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isMissingSeenColumn(error: { code?: string; message?: string }): boolean {
  if (error.code === "42703") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes("seen_at") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

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
    if (isMissingSeenColumn(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function countUnseenNyxText(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .is("media_id", null)
    .is("seen_at", null);
  if (error) {
    if (isMissingSeenColumn(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function countUnseenNyxFromNyx(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .is("seen_at", null);
  if (error) {
    if (isMissingSeenColumn(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function nyxBadgeCounts(playerId: string): Promise<{
  unreadMedia: number;
  unreadText: number;
  unreadTotal: number;
}> {
  const [unreadMedia, unreadText] = await Promise.all([
    countUnseenNyxMedia(playerId),
    countUnseenNyxText(playerId),
  ]);
  return { unreadMedia, unreadText, unreadTotal: unreadMedia + unreadText };
}

export async function markNyxMediaSeen(playerId: string): Promise<number> {
  return markNyxOutboundSeen(playerId);
}

/** Mark all unseen Nyx outbound messages (text + media) as read when opening chat. */
export async function markNyxOutboundSeen(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("nyx_messages")
    .update({ seen_at: now } as never)
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .is("seen_at", null)
    .select("id");
  if (error) {
    if (isMissingSeenColumn(error)) return 0;
    throw error;
  }
  return data?.length ?? 0;
}
