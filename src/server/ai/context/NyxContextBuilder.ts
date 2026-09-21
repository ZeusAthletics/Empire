import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { getJournalState } from "@/server/domain/journal/repository";
import { formatMemoryLine } from "@/server/domain/memory/categories";
import { retrieveRelevantMemories } from "@/server/domain/memory/repository";
import { listLiveOpportunities } from "@/server/domain/opportunity/repository";
import { listOpenPatterns } from "@/server/domain/pattern/repository";
import { listMissions } from "@/server/domain/mission/repository";
import { featuredMission } from "@/server/domain/mission/types";
import { findPlayerById } from "@/server/domain/player/repository";
import { getPlayerModel, summarizePlayerModel } from "@/server/domain/player/playerModel";
import { listVisibleContacts } from "@/server/domain/contact/repository";
import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";

export type NyxContext = {
  task: IntelligenceTask;
  playerSummary: string | null;
  playerModelSummary: string | null;
  currentCampaignState: string | null;
  currentChapter: string | null;
  currentMainQuest: string | null;
  relevantJournalEntries: string[];
  relevantMemories: string[];
  openPatterns: string[];
  liveOpportunities: string[];
  knownAddresses: string[];
  locationRule: string;
};

export async function buildNyxContext(
  playerId: string,
  task: IntelligenceTask,
  memoryQuery = "",
): Promise<NyxContext> {
  const player = await findPlayerById(playerId).catch(() => null);
  const campaign = player ? await findPublicCampaignByPlayerId(playerId).catch(() => null) : null;
  const model = player ? await getPlayerModel(playerId).catch(() => null) : null;
  const missions =
    task === "CASUAL_CHAT" ||
    task === "NYX_EXPLANATION" ||
    task === "SIDE_QUEST_GENERATION" ||
    task === "PLAYER_INTAKE" ||
    task === "MAIN_QUEST_GENERATION"
      ? await listMissions(playerId).catch(() => [])
      : [];
  const journal =
    task === "MEMORY_EXTRACTION" || task === "JOURNAL_CLASSIFICATION" || task === "MONTHLY_WRAP_ANALYSIS"
      ? await getJournalState(playerId).catch(() => null)
      : null;
  const memories = await retrieveRelevantMemories(playerId, memoryQuery).catch(() => []);
  const patterns = await listOpenPatterns(playerId).catch(() => []);
  const opportunities = await listLiveOpportunities(playerId).catch(() => []);

  const contacts = await listVisibleContacts(playerId).catch(() => []);
  const knownAddresses = [
    player?.homeAddress ? `Home Base: ${player.homeAddress}` : null,
    ...contacts.map((contact) => (contact.address ? `${contact.name}: ${contact.address}` : null)),
  ].filter((item): item is string => Boolean(item));

  return {
    task,
    playerSummary: player ? `${player.displayName} · L${player.level} · ${player.title}` : null,
    playerModelSummary: summarizePlayerModel(model),
    currentCampaignState: campaign
      ? `${campaign.title} · ${campaign.northStar} · rem ${campaign.bottleneckStat}`
      : null,
    currentChapter: campaign?.chapter ? `${campaign.chapter.roman} ${campaign.chapter.name}` : null,
    currentMainQuest: featuredMission(missions)?.title ?? null,
    relevantJournalEntries: (journal?.entries ?? []).slice(0, 10).map((entry) => entry.title),
    relevantMemories: memories.map((memory) =>
      formatMemoryLine(memory.domain, memory.category, memory.content || memory.normalizedFact),
    ),
    openPatterns: patterns.map((pattern) => pattern.title),
    liveOpportunities: opportunities.map((item) => item.title),
    knownAddresses,
    locationRule:
      "Map pins require a real Belgian street address (street + house number + town). Look the address up. Never invent coordinates or use only a municipality. Never target restricted contacts.",
  };
}
