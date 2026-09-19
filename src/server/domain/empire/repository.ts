import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyEmpireDelta } from "@/server/domain/empire/apply";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import type { PublicChapter } from "@/server/domain/campaign/types";

export type EmpireValueEntry = {
  id: string;
  at: string;
  delta: number;
  valueAfter: number;
  note: string | null;
};

export type EmpireValueState = {
  current: number;
  from: number;
  to: number;
  chapter: PublicChapter | null;
  entries: EmpireValueEntry[];
};

function mapEntry(row: Record<string, unknown>): EmpireValueEntry {
  return {
    id: row.id as string,
    at: row.at as string,
    delta: row.delta as number,
    valueAfter: row.value_after as number,
    note: (row.note as string | null) ?? null,
  };
}

function missingLedger(message: string) {
  return /empire_value_entries|schema cache|does not exist|relation/i.test(message);
}

export async function getEmpireValueState(playerId: string): Promise<EmpireValueState> {
  const campaign = await findPublicCampaignByPlayerId(playerId);
  const chapter = campaign?.chapter ?? null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("empire_value_entries")
    .select("id, at, delta, value_after, note")
    .eq("player_id", playerId)
    .order("at", { ascending: true })
    .limit(200);
  if (error && !missingLedger(error.message)) throw error;
  const entries = error ? [] : (data ?? []).map((row) => mapEntry(row as Record<string, unknown>));
  return {
    current: chapter?.economicCurrent ?? entries.at(-1)?.valueAfter ?? 0,
    from: chapter?.economicFrom ?? 0,
    to: chapter?.economicTo ?? 0,
    chapter,
    entries,
  };
}

export async function recordEmpireDelta(
  playerId: string,
  delta: number,
  note?: string,
): Promise<EmpireValueState> {
  const campaign = await findPublicCampaignByPlayerId(playerId);
  const chapter = campaign?.chapter;
  if (!chapter) throw new Error("Geen actief hoofdstuk. Empire value kan pas bewegen als de campagne live is.");

  const admin = createSupabaseAdminClient();
  const { data: existing, error: listError } = await admin
    .from("empire_value_entries")
    .select("id")
    .eq("player_id", playerId)
    .limit(1);
  if (listError && missingLedger(listError.message)) {
    throw new Error("Historiek-tabel ontbreekt nog. Plak de Empire value SQL in Supabase.");
  }
  if (listError) throw listError;

  if (!existing?.length) {
    const { error: seedError } = await admin.from("empire_value_entries").insert({
      player_id: playerId,
      chapter_id: chapter.id,
      delta: 0,
      value_after: chapter.economicCurrent,
      note: "Startpunt",
      source: "ADMIN",
      at: new Date().toISOString(),
    } as never);
    if (seedError && !missingLedger(seedError.message)) throw seedError;
  }

  const next = applyEmpireDelta(chapter.economicCurrent, delta);
  const { error: updateError } = await admin
    .from("chapters")
    .update({ economic_current: next } as never)
    .eq("id", chapter.id)
    .eq("player_id", playerId)
    .is("deleted_at", null);
  if (updateError) throw updateError;

  const { error: insertError } = await admin.from("empire_value_entries").insert({
    player_id: playerId,
    chapter_id: chapter.id,
    delta,
    value_after: next,
    note: note?.trim() || null,
    source: "USER",
  } as never);
  if (insertError) {
    await admin
      .from("chapters")
      .update({ economic_current: chapter.economicCurrent } as never)
      .eq("id", chapter.id)
      .eq("player_id", playerId);
    if (missingLedger(insertError.message)) {
      throw new Error("Historiek-tabel ontbreekt nog. Plak de Empire value SQL in Supabase.");
    }
    throw insertError;
  }

  return getEmpireValueState(playerId);
}
