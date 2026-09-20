import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MODE = "COMPANION";

export async function getOrCreateCompanionConversationId(playerId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin
    .from("nyx_conversations")
    .select("id")
    .eq("player_id", playerId)
    .eq("mode", MODE)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await admin
    .from("nyx_conversations")
    .insert({ player_id: playerId, mode: MODE } as never)
    .select("id")
    .single();
  if (createError || !created) throw createError ?? new Error("Companion thread kon niet starten.");
  return created.id as string;
}

export async function appendCompanionNyxMessage(input: {
  playerId: string;
  content: string;
  mediaId?: string | null;
  runId?: string | null;
}): Promise<{ id: string }> {
  const conversationId = await getOrCreateCompanionConversationId(input.playerId);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .insert({
      conversation_id: conversationId,
      player_id: input.playerId,
      role: "NYX",
      content: input.content,
      mode: MODE,
      media_id: input.mediaId ?? null,
      run_id: input.runId ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Outreach bericht kon niet worden bewaard.");
  return { id: data.id as string };
}

export async function companionConversationId(playerId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_conversations")
    .select("id")
    .eq("player_id", playerId)
    .eq("mode", MODE)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}
