import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { getJournalState } from "@/server/domain/journal/repository";
import { retrieveRelevantMemories } from "@/server/domain/memory/repository";
import { listOpenPatterns } from "@/server/domain/pattern/repository";
import { listMissions } from "@/server/domain/mission/repository";
import { featuredMission } from "@/server/domain/mission/types";
import { findPlayerById } from "@/server/domain/player/repository";
import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";

export type NyxContext = {
  task: IntelligenceTask;
  playerSummary: string | null;
  currentCampaignState: string | null;
  currentChapter: string | null;
  currentMainQuest: string | null;
  relevantJournalEntries: string[];
  relevantMemories: string[];
  openPatterns: string[];
};

export async function buildNyxContext(playerId: string, task: IntelligenceTask): Promise<NyxContext> {
  const player = await findPlayerById(playerId).catch(() => null);
  const campaign = player ? await findPublicCampaignByPlayerId(playerId).catch(() => null) : null;
  const missions =
    task === "CASUAL_CHAT" || task === "NYX_EXPLANATION" || task === "SIDE_QUEST_GENERATION"
      ? await listMissions(playerId).catch(() => [])
      : [];
  const journal =
    task === "MEMORY_EXTRACTION" || task === "JOURNAL_CLASSIFICATION" || task === "MONTHLY_WRAP_ANALYSIS"
      ? await getJournalState(playerId).catch(() => null)
      : null;
  const memories = await retrieveRelevantMemories(playerId).catch(() => []);
  const patterns = await listOpenPatterns(playerId).catch(() => []);

  return {
    task,
    playerSummary: player ? `${player.displayName} · L${player.level} · ${player.title}` : null,
    currentCampaignState: campaign ? `${campaign.title} · ${campaign.bottleneckStat}` : null,
    currentChapter: campaign?.chapter ? `${campaign.chapter.roman} ${campaign.chapter.name}` : null,
    currentMainQuest: featuredMission(missions)?.title ?? null,
    relevantJournalEntries: (journal?.entries ?? []).slice(0, 10).map((entry) => entry.title),
    relevantMemories: memories.map((memory) => memory.normalizedFact),
    openPatterns: patterns.map((pattern) => pattern.title),
  };
}
