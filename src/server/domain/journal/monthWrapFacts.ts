import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmpireValueState } from "@/server/domain/empire/repository";
import { monthIdFrom, monthLabel } from "@/server/domain/journal/dates";
import type { JournalEntry } from "@/server/domain/journal/types";
import type { MonthlyWrapNarrative } from "@/server/ai/schemas/monthly-wrap.schema";

export type MonthWrapFacts = {
  monthId: string;
  label: string;
  year: number;
  entries: JournalEntry[];
  events: number;
  newContacts: number;
  missionsCompleted: number;
  empireDelta: number;
  deltas: { network: number; authority: number; execution: number };
  completedMissionTitles: string[];
};

function inMonth(at: string, monthId: string): boolean {
  return monthIdFrom(at) === monthId;
}

function tagCount(entries: JournalEntry[], tag: string): number {
  return entries.filter((entry) => entry.tags.some((t) => t.toUpperCase() === tag.toUpperCase())).length;
}

export async function collectMonthWrapFacts(playerId: string, monthId?: string): Promise<MonthWrapFacts> {
  const id = monthId ?? monthIdFrom(Date.now());
  const { getJournalState } = await import("@/server/domain/journal/repository");
  const [state, empire] = await Promise.all([
    getJournalState(playerId),
    getEmpireValueState(playerId).catch(() => null),
  ]);
  const entries = state.entries.filter((entry) => inMonth(entry.at, id));
  const admin = createSupabaseAdminClient();

  const [{ count: contactCount, error: contactError }, { data: missions, error: missionError }] = await Promise.all([
    admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .is("deleted_at", null)
      .gte("created_at", `${id}-01T00:00:00.000Z`)
      .lt("created_at", nextMonthIso(id)),
    admin
      .from("missions")
      .select("title, completed_at, status")
      .eq("player_id", playerId)
      .in("status", ["COMPLETED", "COMPLETED_UNVERIFIED"])
      .is("deleted_at", null),
  ]);
  if (contactError && !/created_at|schema cache/i.test(contactError.message)) throw contactError;
  if (missionError) throw missionError;

  const completedInMonth = (missions ?? []).filter(
    (row) => row.completed_at && inMonth(row.completed_at as string, id),
  );
  const completedMissionTitles = completedInMonth.map((row) => String(row.title ?? "")).filter(Boolean);

  const empireDelta = (empire?.entries ?? [])
    .filter((entry) => inMonth(entry.at, id))
    .reduce((sum, entry) => sum + (entry.delta ?? 0), 0);

  const network = tagCount(entries, "NETWORK") + tagCount(entries, "EVENT");
  const execution =
    tagCount(entries, "MISSION") + tagCount(entries, "VOLTOOID") + completedInMonth.length + tagCount(entries, "MAP");
  const authority = tagCount(entries, "AUTHORITY") + tagCount(entries, "LEADERSHIP");

  return {
    monthId: id,
    label: monthLabel(id),
    year: Number(id.split("-")[0]) || new Date().getFullYear(),
    entries,
    events: entries.filter((entry) =>
      entry.tags.some((t) => ["EVENT", "NETWORK"].includes(t.toUpperCase())),
    ).length,
    newContacts: contactCount ?? 0,
    missionsCompleted: completedInMonth.length,
    empireDelta,
    deltas: {
      network: Math.min(20, network),
      authority: Math.min(20, authority),
      execution: Math.min(20, execution),
    },
    completedMissionTitles,
  };
}

function nextMonthIso(monthId: string): string {
  const [y, m] = monthId.split("-").map(Number);
  const next = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-01T00:00:00.000Z`;
}

export function formatEntriesForWrapPrompt(entries: JournalEntry[]): string {
  if (!entries.length) return "(geen journal entries deze maand)";
  return entries
    .slice(0, 40)
    .map((entry) => {
      const contacts = entry.contacts.map((c) => c.name).join(", ") || "—";
      const mission = entry.missionTitle ?? "—";
      const tags = entry.tags.join(", ") || "—";
      const body = entry.body.length > 280 ? `${entry.body.slice(0, 277)}…` : entry.body;
      return `- ${entry.at.slice(0, 10)} · ${entry.title}\n  tags: ${tags}\n  contacten: ${contacts}\n  missie: ${mission}\n  ${body}`;
    })
    .join("\n\n");
}

export function offlineWrapNarrative(facts: MonthWrapFacts): MonthlyWrapNarrative {
  if (!facts.entries.length) {
    return {
      biggestWin: "Nog geen dagboeknotities deze maand — de wrap volgt uw echte entries.",
      biggestMistake: "—",
      bestRelationship: "—",
      keyDecision: "—",
      bestMission: facts.completedMissionTitles[0] ?? "—",
      timeSink: "—",
      whatChanged: "Te vroeg voor een betekenisvolle wrap; schrijf eerst enkele entries.",
      nyx: "Ik heb deze maand nog weinig van u gezien op papier. Begin met korte notes na elke beweging — dan kan ik een echte wrap schrijven.",
    };
  }
  const top = facts.entries[0];
  const withContact = facts.entries.find((e) => e.contacts.length);
  return {
    biggestWin: top ? `U legde vast: «${top.title}».` : "—",
    biggestMistake: "Niet af te leiden zonder AI-analyse — bekijk entries met negatieve tags.",
    bestRelationship: withContact
      ? `${withContact.contacts[0]?.name ?? "Contact"} — uit journal: ${withContact.title}.`
      : "Geen contact-entry deze maand.",
    keyDecision: facts.entries.find((e) => /besl|keuze|tarief|prijs/i.test(e.body))?.title ?? "Zie journal voor beslissingen.",
    bestMission: facts.completedMissionTitles[0] ?? facts.entries.find((e) => e.missionTitle)?.missionTitle ?? "—",
    timeSink: facts.entries.find((e) => /website|tool|admin/i.test(e.body))?.title ?? "—",
    whatChanged: `${facts.entries.length} entries · ${facts.missionsCompleted} missies voltooid · empire Δ ${facts.empireDelta}.`,
    nyx: `Deze maand staat ${facts.entries.length} keer in uw journal. Ik heb geen live analyse gedraaid — regenereer wanneer OpenAI beschikbaar is voor scherpere copy.`,
  };
}
