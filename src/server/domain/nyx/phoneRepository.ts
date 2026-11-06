import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ElevenCreditLevel } from "@/server/ai/client/elevenlabs";

export type PhoneCallStatus = "ACTIVE" | "ENDED" | "MISSED" | "QUOTA";

function phoneDbError(error: unknown, fallback: string): Error {
  const code =
    typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message ?? "")
        : String(error ?? "");
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /nyx_phone_calls|nyx_phone_turns|does not exist|schema cache/i.test(message)
  ) {
    return new Error(
      "Telefoon-tabellen ontbreken in de database. Voer migratie 20260926120000_nyx_phone_calls.sql uit in Supabase.",
    );
  }
  return new Error(message || fallback);
}

export type PhoneCall = {
  id: string;
  playerId: string;
  conversationId: string | null;
  status: PhoneCallStatus;
  creditLevel: ElevenCreditLevel;
  startedAt: string;
  endedAt: string | null;
};

export type PhoneTurn = {
  id: string;
  callId: string;
  role: "USER" | "NYX";
  content: string;
  createdAt: string;
};

export async function createPhoneCall(input: {
  playerId: string;
  conversationId: string | null;
  creditLevel: ElevenCreditLevel;
  status?: PhoneCallStatus;
}): Promise<PhoneCall> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_phone_calls")
    .insert({
      player_id: input.playerId,
      conversation_id: input.conversationId,
      credit_level: input.creditLevel,
      status: input.status ?? "ACTIVE",
    } as never)
    .select("id, player_id, conversation_id, status, credit_level, started_at, ended_at")
    .single();
  if (error || !data) throw phoneDbError(error, "Telefoongesprek kon niet starten.");
  return mapCall(data as Record<string, unknown>);
}

export async function getPhoneCall(playerId: string, callId: string): Promise<PhoneCall | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_phone_calls")
    .select("id, player_id, conversation_id, status, credit_level, started_at, ended_at")
    .eq("id", callId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw phoneDbError(error, "Gesprek kon niet worden geladen.");
  return data ? mapCall(data as Record<string, unknown>) : null;
}

export async function endPhoneCall(
  playerId: string,
  callId: string,
  status: PhoneCallStatus = "ENDED",
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("nyx_phone_calls")
    .update({
      status,
      ended_at: new Date().toISOString(),
    } as never)
    .eq("id", callId)
    .eq("player_id", playerId);
  if (error) throw phoneDbError(error, "Gesprek kon niet worden afgesloten.");
}

export async function appendPhoneTurn(input: {
  callId: string;
  playerId: string;
  role: "USER" | "NYX";
  content: string;
}): Promise<PhoneTurn> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_phone_turns")
    .insert({
      call_id: input.callId,
      player_id: input.playerId,
      role: input.role,
      content: input.content.trim(),
    } as never)
    .select("id, call_id, role, content, created_at")
    .single();
  if (error || !data) throw phoneDbError(error, "Call-beurt kon niet worden bewaard.");
  return mapTurn(data as Record<string, unknown>);
}

export async function listPhoneTurns(callId: string): Promise<PhoneTurn[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_phone_turns")
    .select("id, call_id, role, content, created_at")
    .eq("call_id", callId)
    .order("created_at", { ascending: true });
  if (error) throw phoneDbError(error, "Call-beurten konden niet worden geladen.");
  return (data ?? []).map((row) => mapTurn(row as Record<string, unknown>));
}

export function formatPhoneTurnsForPrompt(turns: PhoneTurn[]): string[] {
  return turns.map((turn) => `${turn.role === "USER" ? "Hardwig" : "Nyx"}: ${turn.content}`);
}

function mapCall(row: Record<string, unknown>): PhoneCall {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    conversationId: (row.conversation_id as string | null) ?? null,
    status: row.status as PhoneCallStatus,
    creditLevel: row.credit_level as ElevenCreditLevel,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
  };
}

function mapTurn(row: Record<string, unknown>): PhoneTurn {
  return {
    id: row.id as string,
    callId: row.call_id as string,
    role: row.role as "USER" | "NYX",
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}
