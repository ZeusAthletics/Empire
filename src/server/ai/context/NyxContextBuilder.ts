import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { getJournalState } from "@/server/domain/journal/repository";
import { formatMemoryLine } from "@/server/domain/memory/categories";
import { retrieveRelevantMemories } from "@/server/domain/memory/repository";
import { listLiveOpportunities } from "@/server/domain/opportunity/repository";
import { listOpenPatterns } from "@/server/domain/pattern/repository";
import { listMissions } from "@/server/domain/mission/repository";
import { activeMissionsForNyx, type NyxActiveMissionBrief } from "@/server/domain/mission/nyxContext";
import { featuredMission } from "@/server/domain/mission/types";
import { formatPlayerLocalTime, type PlayerLocalTime } from "@/server/domain/player/localTime";
import { findPlayerById } from "@/server/domain/player/repository";
import { getPlayerModel, summarizePlayerModel } from "@/server/domain/player/playerModel";
import { listVisibleContacts } from "@/server/domain/contact/repository";
import {
  formatRelationshipDirectionForContext,
  getRelationshipDirection,
} from "@/server/domain/nyx/relationship/direction";
import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";

export type NyxContext = {
  task: IntelligenceTask;
  playerSummary: string | null;
  playerModelSummary: string | null;
  currentCampaignState: string | null;
  currentChapter: string | null;
  currentMainQuest: string | null;
  activeMissions: { mainStory: NyxActiveMissionBrief[]; sideQuests: NyxActiveMissionBrief[] } | null;
  relevantJournalEntries: string[];
  relevantMemories: string[];
  openPatterns: string[];
  liveOpportunities: string[];
  knownAddresses: string[];
  locationRule: string;
  playerLocalTime: PlayerLocalTime | null;
  relationshipDirection: string | null;
};

export async function buildNyxContext(
  playerId: string,
  task: IntelligenceTask,
  memoryQuery = "",
): Promise<NyxContext> {
  const player = await findPlayerById(playerId).catch(() => null);
  const campaign = player ? await findPublicCampaignByPlayerId(playerId).catch(() => null) : null;
  const model = player ? await getPlayerModel(playerId).catch(() => null) : null;
  const missionAwareTasks =
    task === "CASUAL_CHAT" ||
    task === "NYX_EXPLANATION" ||
    task === "NYX_OUTREACH" ||
    task === "NYX_RELATIONSHIP_REVIEW" ||
    task === "SIDE_QUEST_GENERATION" ||
    task === "HIGH_IMPACT_SIDE_QUEST" ||
    task === "PLAYER_INTAKE" ||
    task === "MAIN_QUEST_GENERATION";
  const missions = missionAwareTasks ? await listMissions(playerId).catch(() => []) : [];
  const activeMissions = missionAwareTasks ? activeMissionsForNyx(missions) : null;
  const journal =
    task === "MEMORY_EXTRACTION" || task === "JOURNAL_CLASSIFICATION" || task === "MONTHLY_WRAP_ANALYSIS"
      ? await getJournalState(playerId).catch(() => null)
      : null;
  const memories = await retrieveRelevantMemories(playerId, memoryQuery).catch(() => []);
  const patterns = await listOpenPatterns(playerId).catch(() => []);
  const opportunities = await listLiveOpportunities(playerId).catch(() => []);

  const timeAwareTasks =
    task === "CASUAL_CHAT" ||
    task === "NYX_CHECKIN" ||
    task === "NYX_EXPLANATION" ||
    task === "NYX_OUTREACH" ||
    task === "NYX_RELATIONSHIP_REVIEW" ||
    task === "PLAYER_INTAKE" ||
    missionAwareTasks;
  const playerLocalTime =
    player && timeAwareTasks ? formatPlayerLocalTime(player.timeZone) : null;

  const directionAwareTasks =
    task === "CASUAL_CHAT" || task === "NYX_CHECKIN" || task === "NYX_OUTREACH";
  const relationshipDirection = directionAwareTasks
    ? formatRelationshipDirectionForContext(await getRelationshipDirection(playerId).catch(() => ({
        mode: "natural" as const,
        scenarioId: null,
        scenarioTitle: null,
        scenarioSummary: null,
        sourceSnapshotId: null,
        updatedAt: null,
      })))
    : null;

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
    activeMissions,
    relevantJournalEntries: (journal?.entries ?? []).slice(0, 10).map((entry) => entry.title),
    relevantMemories: memories.map((memory) =>
      formatMemoryLine(memory.domain, memory.category, memory.content || memory.normalizedFact),
    ),
    openPatterns: patterns.map((pattern) => pattern.title),
    liveOpportunities: opportunities.map((item) => item.title),
    knownAddresses,
    locationRule:
      "Map pins require a real Belgian street address (street + house number + town). Look the address up. Never invent coordinates or use only a municipality. Never target restricted contacts.",
    playerLocalTime,
    relationshipDirection,
  };
}
