import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { getJournalState } from "@/server/domain/journal/repository";
import { listActiveMemories } from "@/server/domain/memory/repository";
import { listMissions } from "@/server/domain/mission/repository";
import { tryInterrupt } from "@/server/domain/notify/repository";
import {
  createCampaignReviewProposal,
  createPatternProposal,
} from "@/server/domain/nyx/proposalRepository";
import { listPatterns, upsertPattern } from "@/server/domain/pattern/repository";
import { evaluatePattern, groupObservationsByTheme } from "@/server/domain/pattern/thresholds";
import type { PatternObservation } from "@/server/domain/pattern/types";
import type { StatKey } from "@/server/domain/player/types";

export function planPatternDetection(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "PATTERN_DETECTION", risk });
}

function themeFrom(text: string) {
  if (/optional|paden|vrijheid/i.test(text)) return "optionality";
  if (/netwerk|connector|contact/i.test(text)) return "network";
  if (/kapitaal|inkomen|prijs/i.test(text)) return "capital";
  return "";
}

export async function collectObservations(playerId: string): Promise<PatternObservation[]> {
  const [memories, journal, missions] = await Promise.all([
    listActiveMemories(playerId).catch((): Awaited<ReturnType<typeof listActiveMemories>> => []),
    getJournalState(playerId).catch(() => null),
    listMissions(playerId).catch((): Awaited<ReturnType<typeof listMissions>> => []),
  ]);
  const observations: PatternObservation[] = [];
  for (const memory of memories) {
    const theme = themeFrom(`${memory.category} ${memory.normalizedFact}`);
    if (!theme) continue;
    observations.push({
      type: "MEMORY",
      id: memory.id,
      at: memory.firstObservedAt,
      theme,
    });
  }
  for (const entry of journal?.entries ?? []) {
    const theme = themeFrom(`${entry.title} ${entry.body} ${entry.tags.join(" ")}`);
    if (!theme) continue;
    observations.push({ type: "JOURNAL", id: entry.id, at: entry.at, theme });
  }
  for (const mission of missions) {
    const theme = themeFrom(`${mission.title} ${mission.why}`);
    if (!theme) continue;
    observations.push({ type: "MISSION", id: mission.id, at: new Date().toISOString(), theme });
  }
  return observations;
}

export async function detectAndStorePatterns(playerId: string) {
  const observations = await collectObservations(playerId);
  const existing = await listPatterns(playerId).catch((): Awaited<ReturnType<typeof listPatterns>> => []);
  const surfaced: string[] = [];

  for (const [theme, items] of groupObservationsByTheme(observations)) {
    const status = evaluatePattern(items);
    if (status === "NONE") continue;
    const impact: "HIGH" | "MEDIUM" | "CRITICAL" =
      theme === "optionality" || theme === "capital" ? "HIGH" : "MEDIUM";
    const pattern = await upsertPattern(playerId, {
      seedKey: `theme:${theme}`,
      title: theme === "optionality" ? "OPTIONALITY BLIJFT DE REM" : theme.toUpperCase(),
      description:
        status === "SURFACED"
          ? `Drie bronnen over minstens twee weken wijzen naar ${theme}.`
          : `Nog te weinig spreiding om ${theme} als patroon te tonen.`,
      evidenceRefs: items.map(({ type, id, at }) => ({ type, id, at })),
      strategicImpact: impact,
      relatedStats: [theme as StatKey],
      relatedMemoryIds: items.filter((item) => item.type === "MEMORY").map((item) => item.id),
      status,
    });
    if (status === "SURFACED") {
      await createPatternProposal(playerId, {
        title: pattern.title,
        description: pattern.description,
        evidenceRefs: pattern.evidenceRefs,
        strategicImpact: pattern.strategicImpact,
        relatedStats: pattern.relatedStats,
        patternId: pattern.id,
      });
      if (impact === "HIGH") {
        await tryInterrupt(playerId, "PATTERN");
      }
      surfaced.push(pattern.id);
    }
  }

  void existing;
  return { surfaced, campaignTouched: false as const };
}

export async function afterHighMemory(playerId: string) {
  return detectAndStorePatterns(playerId);
}

export async function confirmSurfacedPattern(playerId: string, patternId: string, impact: "HIGH" | "CRITICAL" | string) {
  if (impact !== "HIGH" && impact !== "CRITICAL") return;
  await createCampaignReviewProposal(
    playerId,
    {
      keepBottleneck: false,
      proposedBottleneck: "strategy",
      evidence: ["Bevestigd patroon met hoge impact."],
      impactOnActiveMissions: [],
      whatStays: "Het actieve hoofdstuk blijft staan.",
      preservedElements: ["chapter", "north star", "geschiedenis"],
    },
    "Bevestigd patroon vraagt een campagne-review.",
  );
}
