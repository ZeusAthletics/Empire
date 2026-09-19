import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INTAKE_GREETING } from "@/server/ai/prompts/intake";
import type { NyxChatMessage } from "@/server/domain/nyx/types";

const MODE = "COMPANION";

function mapMessages(rows: { id: string; role: string; content: string }[]): NyxChatMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role === "USER" ? "me" : "nyx",
    text: row.content,
  }));
}

export async function getOrCreateIntakeTalk(playerId: string): Promise<{
  conversationId: string;
  messages: NyxChatMessage[];
}> {
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

  let conversationId = existing?.id as string | undefined;
  if (!conversationId) {
    const { data: created, error: createError } = await admin
      .from("nyx_conversations")
      .insert({ player_id: playerId, mode: MODE } as never)
      .select("id")
      .single();
    if (createError || !created) throw createError ?? new Error("Intake kon niet starten.");
    conversationId = created.id as string;
    const { error: greetError } = await admin.from("nyx_messages").insert({
      conversation_id: conversationId,
      player_id: playerId,
      role: "NYX",
      content: INTAKE_GREETING,
      mode: MODE,
    } as never);
    if (greetError) throw greetError;
  }

  const { data: rows, error: msgError } = await admin
    .from("nyx_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (msgError) throw msgError;

  return { conversationId, messages: mapMessages(rows ?? []) };
}

export async function appendIntakeMessage(input: {
  playerId: string;
  conversationId: string;
  role: "USER" | "NYX";
  content: string;
  runId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .insert({
      conversation_id: input.conversationId,
      player_id: input.playerId,
      role: input.role,
      content: input.content,
      mode: MODE,
      run_id: input.runId ?? null,
    } as never)
    .select("id, role, content")
    .single();
  if (error || !data) throw error ?? new Error("Bericht kon niet worden bewaard.");
  return data;
}

export async function intakeTranscript(playerId: string): Promise<string> {
  const talk = await getOrCreateIntakeTalk(playerId);
  return talk.messages.map((message) => `${message.role === "me" ? "U" : "Nyx"}: ${message.text}`).join("\n");
}
