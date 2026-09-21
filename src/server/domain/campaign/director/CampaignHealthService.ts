import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listExitCriteria } from "@/server/domain/campaign/chapterRepository";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { countPlannedBuffer, listChapterMainMissions } from "@/server/domain/mission/planRepository";

export type HealthIssue =
  | "MISSING_CHAPTER_EXIT_CRITERIA"
  | "NO_PLANNED_MAIN_BUFFER"
  | "TOO_MANY_PLAYABLE_MAIN"
  | "CHAPTER_WITHOUT_CURRENT";

export type HealthReport = {
  issues: HealthIssue[];
  repaired: string[];
};

const MAX_PLAYABLE = 3;

export async function detectCampaignHealth(playerId: string): Promise<HealthReport> {
  const issues: HealthIssue[] = [];
  const record = await getCampaignRecord(playerId);
  if (!record) return { issues: ["CHAPTER_WITHOUT_CURRENT"], repaired: [] };

  const chapter = record.chapter;
  if (!chapter) {
    issues.push("CHAPTER_WITHOUT_CURRENT");
    return { issues, repaired: [] };
  }

  const criteria = await listExitCriteria(chapter.id);
  if (!criteria.length) issues.push("MISSING_CHAPTER_EXIT_CRITERIA");

  const missions = await listChapterMainMissions(playerId, chapter.id);
  const playable = missions.filter((m) => m.status === "PROPOSED" || m.status === "ACTIVE");
  if (playable.length > MAX_PLAYABLE) issues.push("TOO_MANY_PLAYABLE_MAIN");

  const buffer = await countPlannedBuffer(playerId, chapter.id);
  if (buffer < 1 && missions.every((m) => m.status === "COMPLETED" || m.status === "COMPLETED_UNVERIFIED")) {
    issues.push("NO_PLANNED_MAIN_BUFFER");
  }

  return { issues, repaired: [] };
}

export async function repairCampaignHealth(playerId: string): Promise<HealthReport> {
  const report = await detectCampaignHealth(playerId);
  const repaired: string[] = [];
  const record = await getCampaignRecord(playerId);
  if (!record?.chapter) return report;

  const chapter = record.chapter;

  if (report.issues.includes("MISSING_CHAPTER_EXIT_CRITERIA") || report.issues.includes("NO_PLANNED_MAIN_BUFFER")) {
    try {
      const { bootstrapChapter } = await import("@/server/domain/campaign/director/CampaignDirector");
      await bootstrapChapter(playerId, { mode: "replan" });
      repaired.push("bootstrapChapter");
    } catch {
      // leave issues for admin
    }
  }

  if (report.issues.includes("TOO_MANY_PLAYABLE_MAIN")) {
    const { progressCampaign } = await import("@/server/domain/campaign/director/CampaignDirector");
    await progressCampaign(playerId, { reason: "health_repair", skipIdempotency: true });
    repaired.push("enforcePlayableCap");
  }

  const after = await detectCampaignHealth(playerId);
  return { issues: after.issues, repaired };
}

export async function runHealthForAllPlayers(): Promise<{ players: number; reports: number }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("players").select("id").eq("role", "PLAYER");
  if (error) throw error;
  let reports = 0;
  for (const row of data ?? []) {
    await repairCampaignHealth(row.id as string).catch(() => undefined);
    reports += 1;
  }
  return { players: (data ?? []).length, reports };
}
