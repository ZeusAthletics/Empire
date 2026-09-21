import { runNyxTask, StrategicPendingError } from "@/server/ai/orchestrator/NyxOrchestrator";
import {
  CHAPTER_SKELETON_JSON_SCHEMA,
  parseChapterSkeletonPlan,
  type ChapterSkeletonPlan,
} from "@/server/ai/schemas/chapter-skeleton.schema";
import type { ChapterRow } from "@/server/domain/campaign/types";

export async function generateChapterSkeleton(
  playerId: string,
  chapter: ChapterRow,
  mode: "bootstrap" | "replan" | "next",
): Promise<ChapterSkeletonPlan | null> {
  const prompt = [
    `Modus: ${mode}.`,
    `Hoofdstuk ${chapter.roman} — ${chapter.name}.`,
    `Huidige band: €${chapter.economic_current} → €${chapter.economic_to}.`,
    chapter.strategic_purpose ? `Strategisch doel: ${chapter.strategic_purpose}` : "",
    "Lever een hoofdstuk-skeleton met realistische economicFrom/economicTo voor deze fase en machine-evalueerbare exitCriteria.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await runNyxTask({
      playerId,
      task: "CHAPTER_PLANNING",
      text: prompt,
      invokeModel: true,
      jsonSchema: CHAPTER_SKELETON_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    return parseChapterSkeletonPlan(result.text);
  } catch (error) {
    if (error instanceof StrategicPendingError) return null;
    throw error;
  }
}
