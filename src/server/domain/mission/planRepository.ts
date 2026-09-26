import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MainMissionPlan, MainMissionPlanItem } from "@/server/ai/schemas/main-mission-plan.schema";
import type { MissionDifficulty, MissionStatus, MissionTrack } from "@/server/domain/mission/types";
import type { StatKey } from "@/server/domain/player/types";
import { STAT_KEYS } from "@/server/domain/player/types";

export type PlannedMissionRow = {
  id: string;
  player_id: string;
  chapter_id: string | null;
  track: MissionTrack;
  status: MissionStatus;
  narrative_order: number | null;
  title: string;
  strategic_reason: string | null;
  planned_payload: Record<string, unknown> | null;
};

export type DependencyRow = {
  mission_id: string;
  prerequisite_mission_id: string;
};

function asStat(value: string): StatKey {
  return STAT_KEYS.includes(value as StatKey) ? (value as StatKey) : "execution";
}

function asDifficulty(value: string): MissionDifficulty {
  const key = value.toUpperCase();
  if (key === "LOW" || key === "MEDIUM" || key === "HIGH" || key === "BOSS") return key;
  return "MEDIUM";
}

export async function listChapterMainMissions(
  playerId: string,
  chapterId: string,
  options?: { includeUnassignedChapter?: boolean },
): Promise<PlannedMissionRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("missions")
    .select("id, player_id, chapter_id, track, status, narrative_order, title, strategic_reason, planned_payload")
    .eq("player_id", playerId)
    .eq("track", "MAIN_STORY")
    .is("deleted_at", null)
    .order("narrative_order", { ascending: true });
  if (options?.includeUnassignedChapter) {
    query = query.or(`chapter_id.eq.${chapterId},chapter_id.is.null`);
  } else {
    query = query.eq("chapter_id", chapterId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlannedMissionRow[];
}

export async function listDependencies(playerId: string, missionIds: string[]): Promise<DependencyRow[]> {
  if (!missionIds.length) return [];
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("mission_dependencies")
    .select("mission_id, prerequisite_mission_id")
    .eq("player_id", playerId)
    .in("mission_id", missionIds);
  if (error) throw error;
  return (data ?? []) as DependencyRow[];
}

export async function countPlannedBuffer(playerId: string, chapterId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("chapter_id", chapterId)
    .eq("track", "MAIN_STORY")
    .in("status", ["PLANNED", "LOCKED", "PROPOSED"])
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function insertMainMissionPlan(
  playerId: string,
  chapterId: string,
  plan: MainMissionPlan,
  replaceExistingPlanned: boolean,
): Promise<Map<number, string>> {
  const admin = createSupabaseAdminClient();
  const orderToId = new Map<number, string>();

  if (replaceExistingPlanned) {
    const { data: existing } = await admin
      .from("missions")
      .select("id, status")
      .eq("player_id", playerId)
      .eq("chapter_id", chapterId)
      .eq("track", "MAIN_STORY")
      .in("status", ["PLANNED", "LOCKED", "ARCHIVED"])
      .is("deleted_at", null);
    const removable = (existing ?? []).map((row) => row.id as string);
    if (removable.length) {
      await admin.from("mission_dependencies").delete().in("mission_id", removable);
      const { error: archiveError } = await admin
        .from("missions")
        .update({ status: "ARCHIVED", deleted_at: new Date().toISOString() } as never)
        .in("id", removable);
      if (archiveError) throw archiveError;
    }
  }

  const sorted = [...plan.missions].sort((a, b) => a.narrativeOrder - b.narrativeOrder).slice(0, 10);

  for (const item of sorted) {
    const id = await insertPlannedMission(playerId, chapterId, item);
    orderToId.set(item.narrativeOrder, id);
  }

  for (const item of sorted) {
    const missionId = orderToId.get(item.narrativeOrder);
    if (!missionId || item.prerequisiteOrder <= 0) continue;
    const prereqId = orderToId.get(item.prerequisiteOrder);
    if (!prereqId) continue;
    const { error } = await admin.from("mission_dependencies").insert({
      player_id: playerId,
      mission_id: missionId,
      prerequisite_mission_id: prereqId,
    } as never);
    if (error) throw error;
  }

  return orderToId;
}

async function insertPlannedMission(playerId: string, chapterId: string, item: MainMissionPlanItem): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("missions")
    .insert({
      player_id: playerId,
      chapter_id: chapterId,
      kind: "MAIN",
      track: "MAIN_STORY",
      title: item.title.trim().toUpperCase(),
      why: item.why,
      main_objective: item.mainObjective,
      status: "PLANNED",
      difficulty: asDifficulty(item.difficulty),
      estimate_label: item.estimateLabel,
      impact: item.strategicReason,
      xp_reward: Math.max(50, item.xpReward),
      xp_granted: 0,
      stat_reward_key: asStat(item.statKey),
      stat_reward_amount: item.statAmount,
      evidence_requirement: item.evidenceRequirement,
      narrative_order: item.narrativeOrder,
      strategic_reason: item.strategicReason,
      success_criteria: item.successCriteria,
      expected_state_changes: item.expectedStateChanges,
      unlock_conditions: item.unlockConditions,
      planned_payload: item,
      source: "AI",
      featured: item.narrativeOrder === 1,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Geplande missie kon niet worden aangemaakt.");

  const missionId = data.id as string;
  if (item.objectives.length) {
    const { error: objError } = await admin.from("mission_objectives").insert(
      item.objectives.map((label, index) => ({
        mission_id: missionId,
        label,
        sort_order: index,
        optional: false,
        status: "OPEN",
      })) as never,
    );
    if (objError) throw objError;
  }

  return missionId;
}

export async function setMissionStatuses(
  playerId: string,
  updates: { id: string; status: MissionStatus }[],
): Promise<void> {
  if (!updates.length) return;
  const admin = createSupabaseAdminClient();
  for (const row of updates) {
    const { error } = await admin
      .from("missions")
      .update({ status: row.status } as never)
      .eq("id", row.id)
      .eq("player_id", playerId);
    if (error) throw error;
  }
}

export async function promoteMissionToProposed(missionId: string, playerId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("missions")
    .update({ status: "PROPOSED", revalidated_at: new Date().toISOString() } as never)
    .eq("id", missionId)
    .eq("player_id", playerId);
  if (error) throw error;
}

export async function countCompletedMainInChapter(playerId: string, chapterId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("chapter_id", chapterId)
    .eq("track", "MAIN_STORY")
    .in("status", ["COMPLETED", "COMPLETED_UNVERIFIED"])
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
