import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatChatLineForPrompt } from "@/server/domain/nyx/chatFormat";

export async function recentPlayerChatTurns(playerId: string, limit = 16): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("role, content, media_id, media_context, attachment_context, linked_url, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return [...(data ?? [])].reverse().map((row) =>
    formatChatLineForPrompt(
      row as {
        role: string;
        content: string;
        media_id?: string | null;
        media_context?: string | null;
        attachment_context?: string | null;
        linked_url?: string | null;
      },
    ),
  );
}
