import { runNyxTask, StrategicPendingError } from "@/server/ai/orchestrator/NyxOrchestrator";
import {
  MAIN_MISSION_PLAN_JSON_SCHEMA,
  parseMainMissionPlan,
  type MainMissionPlan,
} from "@/server/ai/schemas/main-mission-plan.schema";
import type { ChapterRow } from "@/server/domain/campaign/types";

export async function generateMainMissionBatch(
  playerId: string,
  chapter: ChapterRow,
  batchNote: string,
): Promise<MainMissionPlan | null> {
  const prompt = [
    batchNote,
    `Hoofdstuk ${chapter.roman} — ${chapter.name}.`,
    chapter.strategic_purpose ? `Doel: ${chapter.strategic_purpose}` : "",
    "Plan precies tien MAIN_STORY missies (narrativeOrder 1..10) met prerequisiteOrder (0 = geen).",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await runNyxTask({
      playerId,
      task: "MAIN_QUEST_GENERATION",
      text: prompt,
      invokeModel: true,
      jsonSchema: MAIN_MISSION_PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    return parseMainMissionPlan(result.text);
  } catch (error) {
    if (error instanceof StrategicPendingError) return null;
    throw error;
  }
}
