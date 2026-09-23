import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { monthIdFrom, monthLabel, titleFromBody } from "@/server/domain/journal/dates";
import type {
  CreateJournalInput,
  JournalEntry,
  JournalMedia,
  JournalMediaKind,
  JournalState,
  MonthlyWrap,
} from "@/server/domain/journal/types";
import type { RecordSource } from "@/server/domain/mission/types";

const WRAP_SELECT =
  "month_id, label, year, events, new_contacts, missions_completed, empire_delta, deltas, biggest_win, biggest_mistake, best_relationship, key_decision, best_mission, time_sink, what_changed, nyx, generated_at, entry_ids, media";

const MEDIA_KINDS = new Set<JournalMediaKind>(["gym", "note", "meet", "city", "room", "book", "mission"]);

function asMedia(value: unknown): JournalMedia[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { kind?: string; label?: string; src?: string; approved?: boolean; mediaId?: string };
      const kind = MEDIA_KINDS.has(row.kind as JournalMediaKind) ? (row.kind as JournalMediaKind) : "note";
      const media: JournalMedia = {
        kind,
        label: typeof row.label === "string" ? row.label : "Beeld",
      };
      if (typeof row.src === "string") media.src = row.src;
      if (row.approved) media.approved = true;
      if (typeof row.mediaId === "string") media.mediaId = row.mediaId;
      return media;
    })
    .filter((item): item is JournalMedia => Boolean(item));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function mapWrap(row: Record<string, unknown>): MonthlyWrap {
  const deltas = row.deltas && typeof row.deltas === "object" && !Array.isArray(row.deltas)
    ? (row.deltas as Record<string, number>)
    : {};
  return {
    id: row.month_id as string,
    label: row.label as string,
    year: row.year as number,
    events: row.events as number,
    newContacts: row.new_contacts as number,
    missionsCompleted: row.missions_completed as number,
    empireDelta: row.empire_delta as number,
    deltas,
    biggestWin: row.biggest_win as string,
    biggestMistake: row.biggest_mistake as string,
    bestRelationship: row.best_relationship as string,
    keyDecision: row.key_decision as string,
    bestMission: row.best_mission as string,
    timeSink: row.time_sink as string,
    whatChanged: row.what_changed as string,
    nyx: row.nyx as string,
    generatedAt: (row.generated_at as string | null) ?? null,
    entryIds: asStringArray(row.entry_ids),
    media: asMedia(row.media),
  };
}

function matchContactIds(text: string, contacts: { id: string; name: string; restricted: boolean }[]): string[] {
  const ids: string[] = [];
  for (const contact of contacts) {
    if (contact.restricted) continue;
    const tokens = [contact.name, contact.name.split(/\s+/)[0]].filter((token) => token && token.length > 2);
    if (tokens.some((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))) {
      ids.push(contact.id);
    }
  }
  return [...new Set(ids)];
}

function assembleEntry(
  row: Record<string, unknown>,
  contactsById: Map<string, { id: string; name: string }>,
  missionTitle: string | null,
): JournalEntry {
  const contactIds = asStringArray(row.contact_ids);
  return {
    id: row.id as string,
    at: row.occurred_at as string,
    title: row.title as string,
    body: row.body as string,
    icon: (row.icon as string) || "edit",
    tags: asStringArray(row.tags),
    contactIds,
    contacts: contactIds
      .map((id) => contactsById.get(id))
      .filter((contact): contact is { id: string; name: string } => Boolean(contact)),
    missionId: (row.mission_id as string | null) ?? null,
    missionTitle,
    locationName: (row.location_name as string | null) ?? null,
    media: asMedia(row.media),
    extraMedia: Number(row.extra_media ?? 0),
    source: (row.source as RecordSource) ?? "USER",
    lockedByAdmin: Boolean(row.locked_by_admin),
  };
}

async function loadLookups(playerId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: contacts, error: contactError }, { data: missions, error: missionError }] = await Promise.all([
    admin.from("contacts").select("id, name, restricted").eq("player_id", playerId).is("deleted_at", null),
    admin.from("missions").select("id, title").eq("player_id", playerId).is("deleted_at", null),
  ]);
  if (contactError) throw contactError;
  if (missionError) throw missionError;
  const visible = (contacts ?? []).filter((contact) => !contact.restricted);
  return {
    admin,
    contacts: (contacts ?? []).map((contact) => ({
      id: contact.id as string,
      name: contact.name as string,
      restricted: Boolean(contact.restricted),
    })),
    contactsById: new Map(visible.map((contact) => [contact.id as string, { id: contact.id as string, name: contact.name as string }])),
    missionTitle: new Map((missions ?? []).map((mission) => [mission.id as string, mission.title as string])),
  };
}

export async function getJournalState(playerId: string): Promise<JournalState> {
  const { syncMissingMissionJournalEntries } = await import("@/server/domain/journal/missionJournal");
  await syncMissingMissionJournalEntries(playerId).catch(() => undefined);

  const { admin, contactsById, missionTitle } = await loadLookups(playerId);
  const [{ data: rows, error }, { data: wraps, error: wrapError }] = await Promise.all([
    admin
      .from("journal_entries")
      .select(
        "id, occurred_at, title, body, icon, tags, contact_ids, mission_id, location_name, media, extra_media, source, locked_by_admin",
      )
      .eq("player_id", playerId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false }),
    admin
      .from("monthly_wraps")
      .select(
        WRAP_SELECT,
      )
      .eq("player_id", playerId)
      .is("deleted_at", null)
      .order("month_id", { ascending: false }),
  ]);
  if (error) throw error;
  if (wrapError) throw wrapError;

  const entries = (rows ?? []).map((row) =>
    assembleEntry(row as Record<string, unknown>, contactsById, row.mission_id ? (missionTitle.get(row.mission_id as string) ?? null) : null),
  );
  const currentMonth = monthIdFrom(Date.now());
  return {
    entries,
    wraps: (wraps ?? []).map((row) => mapWrap(row as Record<string, unknown>)),
    monthEntryCount: entries.filter((entry) => monthIdFrom(entry.at) === currentMonth).length,
  };
}

export async function getMonthlyWrap(playerId: string, monthId: string): Promise<MonthlyWrap | null> {
  const state = await getJournalState(playerId);
  return state.wraps.find((wrap) => wrap.id === monthId) ?? null;
}

export async function createJournalEntry(playerId: string, input: CreateJournalInput): Promise<JournalEntry> {
  const media = input.media ?? [];
  let body = input.body.trim();
  if (!body && !media.length) throw new Error("Schrijf iets of voeg een foto toe.");
  if (!body && media.length) body = "Foto in journal.";

  const { admin, contacts, contactsById, missionTitle } = await loadLookups(playerId);
  const contactIds = matchContactIds(body, contacts);
  const tags = [...(input.tags ?? ["QUICK NOTE"])];
  if (contactIds.length && !tags.includes("NETWORK")) tags.push("NETWORK");

  const { data, error } = await admin
    .from("journal_entries")
    .insert({
      player_id: playerId,
      title: titleFromBody(body),
      body,
      icon: input.icon ?? "edit",
      tags,
      contact_ids: contactIds,
      mission_id: input.missionId ?? null,
      location_name: input.locationName ?? null,
      media,
      extra_media: 0,
      extraction_status: "PENDING",
      source: "USER",
    } as never)
    .select(
      "id, occurred_at, title, body, icon, tags, contact_ids, mission_id, location_name, media, extra_media, source, locked_by_admin",
    )
    .single();
  if (error || !data) throw error ?? new Error("Notitie kon niet worden bewaard.");

  return assembleEntry(
    data as Record<string, unknown>,
    contactsById,
    data.mission_id ? (missionTitle.get(data.mission_id as string) ?? null) : null,
  );
}

export async function deleteJournalEntry(playerId: string, entryId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("journal_entries")
    .select("id, locked_by_admin")
    .eq("player_id", playerId)
    .eq("id", entryId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Entry niet gevonden.");
  if (data.locked_by_admin) throw new Error("Deze entry is vergrendeld.");

  const { error: delError } = await admin
    .from("journal_entries")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", entryId)
    .eq("player_id", playerId);
  if (delError) throw delError;
}

export async function generateMonthlyWrap(playerId: string): Promise<MonthlyWrap> {
  const { analyzeMonthlyWrapNarrative, buildMonthlyWrapFacts } = await import(
    "@/server/ai/services/MonthlyWrapService"
  );
  const facts = await buildMonthlyWrapFacts(playerId);
  const narrative = await analyzeMonthlyWrapNarrative(playerId, facts);
  const admin = createSupabaseAdminClient();

  const fields = {
    player_id: playerId,
    month_id: facts.monthId,
    label: facts.label,
    year: facts.year,
    events: facts.events,
    new_contacts: facts.newContacts,
    missions_completed: facts.missionsCompleted,
    empire_delta: facts.empireDelta,
    deltas: facts.deltas,
    biggest_win: narrative.biggestWin,
    biggest_mistake: narrative.biggestMistake,
    best_relationship: narrative.bestRelationship,
    key_decision: narrative.keyDecision,
    best_mission: narrative.bestMission,
    time_sink: narrative.timeSink,
    what_changed: narrative.whatChanged,
    nyx: narrative.nyx,
    generated_at: new Date().toISOString(),
    entry_ids: facts.entries.slice(0, 80).map((entry) => entry.id),
    source: "USER",
    deleted_at: null,
  };

  const { data: existing, error: lookupError } = await admin
    .from("monthly_wraps")
    .select("id")
    .eq("player_id", playerId)
    .eq("month_id", facts.monthId)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const { data, error } = existing
    ? await admin.from("monthly_wraps").update(fields as never).eq("id", existing.id).select(WRAP_SELECT).single()
    : await admin.from("monthly_wraps").insert(fields as never).select(WRAP_SELECT).single();
  if (error || !data) throw error ?? new Error("Wrap kon niet worden gemaakt.");
  return mapWrap(data as Record<string, unknown>);
}

export async function listMonthlyWraps(playerId: string): Promise<MonthlyWrap[]> {
  const state = await getJournalState(playerId);
  return state.wraps;
}

export async function appendWrapPhoto(
  playerId: string,
  monthId: string,
  item: JournalMedia,
): Promise<MonthlyWrap> {
  const existing = await getMonthlyWrap(playerId, monthId);
  if (!existing) throw new Error("Wrap niet gevonden. Maak eerst een wrap voor deze maand.");
  const admin = createSupabaseAdminClient();
  const media = [...existing.media, item].slice(0, 12);
  const { data, error } = await admin
    .from("monthly_wraps")
    .update({ media } as never)
    .eq("player_id", playerId)
    .eq("month_id", monthId)
    .is("deleted_at", null)
    .select(WRAP_SELECT)
    .single();
  if (error || !data) throw error ?? new Error("Foto kon niet aan de wrap worden gekoppeld.");
  return mapWrap(data as Record<string, unknown>);
}
