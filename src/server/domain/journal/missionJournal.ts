import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JournalEntry, JournalMedia } from "@/server/domain/journal/types";

export function missionJournalSeedKey(missionId: string): string {
  return `mission-complete:${missionId}`;
}

export function buildMissionCompletionBody(mission: {
  title: string;
  mainObjective: string;
  why: string;
  xpReward: number;
  statReward: { key: string; amount: number };
  evidenceRequirement: string;
  locationName: string | null;
  objectives: { label: string; optional: boolean; status: string }[];
}): string {
  const lines = [
    `Missie voltooid: ${mission.title}`,
    "",
    mission.mainObjective,
    "",
    ...mission.objectives
      .filter((objective) => !objective.optional && objective.status === "COMPLETED")
      .map((objective) => `• ${objective.label}`),
  ].filter(Boolean);

  if (mission.evidenceRequirement?.trim()) {
    lines.push("", `Bewijs: ${mission.evidenceRequirement.trim()}`);
  }
  lines.push(
    "",
    `Beloning: +${mission.xpReward} XP · ${mission.statReward.key.toUpperCase()} +${mission.statReward.amount}`,
  );
  if (mission.locationName?.trim()) {
    lines.push(`Locatie: ${mission.locationName.trim()}`);
  }
  return lines.join("\n").trim();
}

export async function createMissionCompletionJournalEntry(
  playerId: string,
  missionId: string,
): Promise<JournalEntry | null> {
  const admin = createSupabaseAdminClient();
  const seedKey = missionJournalSeedKey(missionId);

  const { data: existing } = await admin
    .from("journal_entries")
    .select("id")
    .eq("player_id", playerId)
    .eq("seed_key", seedKey)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) return null;

  const { data: mission, error: missionError } = await admin
    .from("missions")
    .select(
      "id, title, main_objective, why, xp_reward, stat_reward_key, stat_reward_amount, evidence_requirement, location_name, completed_at, status",
    )
    .eq("id", missionId)
    .eq("player_id", playerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (missionError || !mission) return null;

  const status = mission.status as string;
  if (status !== "COMPLETED" && status !== "COMPLETED_UNVERIFIED") return null;

  const { data: objectives } = await admin
    .from("mission_objectives")
    .select("label, optional, status")
    .eq("mission_id", missionId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const body = buildMissionCompletionBody({
    title: mission.title as string,
    mainObjective: mission.main_objective as string,
    why: mission.why as string,
    xpReward: Number(mission.xp_reward ?? 0),
    statReward: {
      key: mission.stat_reward_key as string,
      amount: Number(mission.stat_reward_amount ?? 0),
    },
    evidenceRequirement: (mission.evidence_requirement as string) ?? "",
    locationName: (mission.location_name as string | null) ?? null,
    objectives: (objectives ?? []).map((row) => ({
      label: row.label as string,
      optional: Boolean(row.optional),
      status: row.status as string,
    })),
  });

  const media: JournalMedia[] = [{ kind: "mission", label: mission.title as string }];
  const occurredAt =
    (mission.completed_at as string | null) ?? new Date().toISOString();

  const { data, error } = await admin
    .from("journal_entries")
    .insert({
      player_id: playerId,
      seed_key: seedKey,
      occurred_at: occurredAt,
      title: mission.title as string,
      body,
      icon: "target",
      tags: ["MISSION", "VOLTOOID"],
      mission_id: missionId,
      location_name: (mission.location_name as string | null) ?? null,
      media,
      extra_media: 0,
      extraction_status: "SKIPPED",
      source: "AI",
    } as never)
    .select(
      "id, occurred_at, title, body, icon, tags, contact_ids, mission_id, location_name, media, extra_media, source, locked_by_admin",
    )
    .single();
  if (error || !data) throw error ?? new Error("Journal-entry voor missie kon niet worden aangemaakt.");

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    at: row.occurred_at as string,
    title: row.title as string,
    body: row.body as string,
    icon: (row.icon as string) || "target",
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : ["MISSION"],
    contactIds: [],
    contacts: [],
    missionId,
    missionTitle: mission.title as string,
    locationName: (row.location_name as string | null) ?? null,
    media,
    extraMedia: 0,
    source: "AI",
    lockedByAdmin: false,
  };
}

/** Backfill journal rows for completed missions that predate auto-logging. */
export async function syncMissingMissionJournalEntries(playerId: string, limit = 12): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: missions, error } = await admin
    .from("missions")
    .select("id, completed_at")
    .eq("player_id", playerId)
    .in("status", ["COMPLETED", "COMPLETED_UNVERIFIED"])
    .is("deleted_at", null)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  let created = 0;
  for (const row of missions ?? []) {
    const entry = await createMissionCompletionJournalEntry(playerId, row.id as string);
    if (entry) created += 1;
  }
  return created;
}
