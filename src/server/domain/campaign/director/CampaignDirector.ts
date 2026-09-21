import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateChapterSkeleton } from "@/server/ai/services/ChapterPlanner";
import { generateMainMissionBatch } from "@/server/ai/services/MainMissionPlanner";
import {
  activateChapter,
  applySkeletonPlan,
  completeChapter,
  insertNextChapterPlaceholder,
  listExitCriteria,
  markCriteriaMet,
  replaceExitCriteriaFromPlan,
} from "@/server/domain/campaign/chapterRepository";
import { acquireCampaignLock, releaseCampaignLock } from "@/server/domain/campaign/director/campaignLock";
import {
  evaluateExitCriteria,
  type EvaluableCriterion,
} from "@/server/domain/campaign/director/ChapterEvaluationService";
import { recordCampaignEvent } from "@/server/domain/campaign/director/events";
import { eligibleToUnlock } from "@/server/domain/campaign/director/MissionDependencyService";
import { selectPlayable } from "@/server/domain/campaign/director/MissionAvailabilityService";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import type { ChapterRow } from "@/server/domain/campaign/types";
import {
  countCompletedMainInChapter,
  countPlannedBuffer,
  insertMainMissionPlan,
  listChapterMainMissions,
  listDependencies,
  setMissionStatuses,
} from "@/server/domain/mission/planRepository";
import type { StatKey } from "@/server/domain/player/types";
import { STAT_KEYS } from "@/server/domain/player/types";
import { extractErrorMessage } from "@/server/domain/campaign/director/replanErrors";

const PLAYABLE_CAP = 3;
const BUFFER_MIN = 3;

function indexToRoman(index: number): string {
  const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return map[index - 1] ?? String(index);
}

async function loadStats(playerId: string): Promise<Partial<Record<StatKey, number>>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("stat_values").select("stat_key, value").eq("player_id", playerId);
  if (error) throw error;
  const out: Partial<Record<StatKey, number>> = {};
  for (const row of data ?? []) {
    const key = row.stat_key as StatKey;
    if (STAT_KEYS.includes(key)) out[key] = Number(row.value ?? 0);
  }
  return out;
}

async function buildSnapshot(playerId: string, chapter: ChapterRow) {
  const stats = await loadStats(playerId);
  const completedMainMissionCount = await countCompletedMainInChapter(playerId, chapter.id);
  return {
    stats,
    empireValue: chapter.economic_current,
    completedMainMissionCount,
  };
}

async function syncPlayableAndUnlock(playerId: string, chapterId: string): Promise<void> {
  const missions = await listChapterMainMissions(playerId, chapterId);
  const completedIds = new Set(
    missions.filter((m) => m.status === "COMPLETED" || m.status === "COMPLETED_UNVERIFIED").map((m) => m.id),
  );
  const edges = await listDependencies(
    playerId,
    missions.map((m) => m.id),
  );
  const unlockIds = new Set(
    eligibleToUnlock(
      missions.map((m) => ({ id: m.id, status: m.status })),
      edges.map((e) => ({ missionId: e.mission_id, prerequisiteMissionId: e.prerequisite_mission_id })),
      completedIds,
    ),
  );

  const selection = selectPlayable(
    missions.map((m) => ({
      id: m.id,
      track: m.track,
      status: m.status,
      narrativeOrder: m.narrative_order,
    })),
    PLAYABLE_CAP,
  );

  const updates: { id: string; status: "PROPOSED" | "LOCKED" | "PLANNED" }[] = [];

  for (const id of selection.playableIds) {
    const mission = missions.find((m) => m.id === id);
    if (!mission) continue;
    if (mission.status === "ACTIVE") continue;
    if (unlockIds.has(id) || !edges.some((e) => e.mission_id === id && e.prerequisite_mission_id)) {
      updates.push({ id, status: "PROPOSED" });
    }
  }

  for (const id of selection.demoteToLocked) {
    if (selection.playableIds.includes(id)) continue;
    updates.push({ id, status: "LOCKED" });
  }

  for (const id of selection.demoteToPlanned) {
    updates.push({ id, status: "PLANNED" });
  }

  if (updates.length) await setMissionStatuses(playerId, updates);
}

export async function bootstrapChapter(
  playerId: string,
  options: { mode?: "bootstrap" | "replan" } = {},
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const record = await getCampaignRecord(playerId);
    if (!record?.chapter) return { ok: false, reason: "no_chapter" };

    const chapter = record.chapter;
    const mode = options.mode ?? "bootstrap";

    const skeleton = await generateChapterSkeleton(playerId, chapter, mode === "replan" ? "replan" : "bootstrap");
    if (!skeleton) return { ok: false, reason: "planner_failed" };

    const updated = await applySkeletonPlan(chapter, skeleton);
    await replaceExitCriteriaFromPlan(playerId, chapter.id, skeleton, chapter.locked_by_admin);

    const plan = await generateMainMissionBatch(
      playerId,
      updated,
      mode === "replan" ? "Replann hoofdstuk in place — ten nieuwe main missions." : "Eerste batch main missions.",
    );
    if (!plan) return { ok: false, reason: "mission_planner_failed" };

    await insertMainMissionPlan(playerId, chapter.id, plan, mode === "replan");
    await syncPlayableAndUnlock(playerId, chapter.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: extractErrorMessage(error) };
  }
}

export async function replanChapterInPlace(playerId: string): Promise<{ ok: boolean; reason?: string }> {
  return bootstrapChapter(playerId, { mode: "replan" });
}

async function maybeExpandBuffer(playerId: string, chapter: ChapterRow): Promise<void> {
  const buffer = await countPlannedBuffer(playerId, chapter.id);
  if (buffer >= BUFFER_MIN) return;

  const plan = await generateMainMissionBatch(playerId, chapter, "Buffer uitbreiden — extra batch geplande missies.");
  if (!plan) return;
  await insertMainMissionPlan(playerId, chapter.id, plan, false);
}

export async function activateNextChapter(playerId: string, campaignId: string, currentChapter: ChapterRow): Promise<void> {
  const admin = createSupabaseAdminClient();
  const nextIndex = currentChapter.index + 1;
  const { data: existing } = await admin
    .from("chapters")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("index", nextIndex)
    .maybeSingle();

  let nextId = existing?.id as string | undefined;
  if (!nextId) {
    nextId = await insertNextChapterPlaceholder(
      playerId,
      campaignId,
      nextIndex,
      indexToRoman(nextIndex),
      `HOOFDSTUK ${indexToRoman(nextIndex)}`,
    );
  }

  await activateChapter(nextId, campaignId);
  const { data: nextChapter } = await admin.from("chapters").select("*").eq("id", nextId).single();
  if (nextChapter) {
    await bootstrapChapter(playerId, { mode: "bootstrap" });
  }
}

export async function progressCampaign(
  playerId: string,
  options: { missionId?: string; reason?: string; skipIdempotency?: boolean } = {},
): Promise<{ progressed: boolean; chapterCompleted?: boolean }> {
  const record = await getCampaignRecord(playerId);
  if (!record?.chapter) return { progressed: false };

  const { campaign, chapter } = record;
  const locked = await acquireCampaignLock(campaign.id);
  if (!locked) return { progressed: false };

  try {
    if (options.missionId && !options.skipIdempotency) {
      const fresh = await recordCampaignEvent({
        playerId,
        campaignId: campaign.id,
        eventType: "MISSION_COMPLETED",
        idempotencyKey: `MISSION_COMPLETED:${options.missionId}`,
        payload: { missionId: options.missionId, reason: options.reason ?? "completion" },
      });
      if (!fresh) return { progressed: false };
    }

    const criteriaRows = await listExitCriteria(chapter.id);
    const evaluable: EvaluableCriterion[] = criteriaRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      statKey: row.stat_key,
      comparator: row.comparator,
      targetValue: row.target_value != null ? Number(row.target_value) : null,
    }));

    const snapshot = await buildSnapshot(playerId, chapter);
    const evaluation = evaluateExitCriteria(evaluable, snapshot);
    const newlyMet = evaluation.evaluations.filter((e) => e.met && e.nextStatus === "MET").map((e) => e.id);
    await markCriteriaMet(newlyMet);

    if (evaluation.allMet && chapter.status === "ACTIVE") {
      await completeChapter(chapter.id);
      await activateNextChapter(playerId, campaign.id, chapter);
      return { progressed: true, chapterCompleted: true };
    }

    await syncPlayableAndUnlock(playerId, chapter.id);
    await maybeExpandBuffer(playerId, chapter);

    return { progressed: true, chapterCompleted: false };
  } finally {
    await releaseCampaignLock(campaign.id);
  }
}

export async function forceProgressCampaign(playerId: string): Promise<{ progressed: boolean }> {
  return progressCampaign(playerId, { skipIdempotency: true, reason: "admin_force" });
}
