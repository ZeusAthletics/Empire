import { openaiConfigured } from "@/server/ai/client/openai";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import {
  extractEntitiesOffline,
  extractMemoryCandidatesOffline,
  parseMemoryCandidates,
} from "@/server/ai/fallback/extractMemories";
import { MEMORY_CANDIDATES_SCHEMA, type MemoryCandidate } from "@/server/ai/schemas/memory.schema";
import { insertMemory, bumpObservation, listActiveMemories } from "@/server/domain/memory/repository";
import type { Memory } from "@/server/domain/memory/types";
import { createMemoryProposal } from "@/server/domain/nyx/proposalRepository";
import { afterHighMemory } from "@/server/ai/services/StrategicPatternService";
import { MEMORY_EXTRACTION_GUIDE, normalizeMemoryCategory } from "@/server/domain/memory/categories";
import { applyMemoryDecision, normalizeFact } from "@/server/validation/MemoryValidationService";

const EXTRACT_PROMPT = `Haal 0 tot 5 memories uit deze beurt. Nul is normaal.
Alleen feiten of voorkeuren die de speler zelf zegt. Geen inferenties.
Geen hoofdstuk, doelen of campagne wijzigen.
${MEMORY_EXTRACTION_GUIDE}
JSON: { "candidates": MemoryCandidate[] }`;

export function planMemoryExtraction() {
  return planNyxTask({ task: "MEMORY_EXTRACTION" });
}

export function planEntityExtraction() {
  return planNyxTask({ task: "ENTITY_EXTRACTION" });
}

export async function collectTurnCandidates(input: {
  playerId: string;
  userText: string;
  nyxText: string;
  useModel?: boolean;
}): Promise<MemoryCandidate[]> {
  let extracted: MemoryCandidate[] = [];
  if (input.useModel && openaiConfigured()) {
    const live = await runNyxTask({
      playerId: input.playerId,
      task: "MEMORY_EXTRACTION",
      text: `${EXTRACT_PROMPT}\n\nSpeler: ${input.userText}\nNyx: ${input.nyxText}`,
      invokeModel: true,
      jsonSchema: MEMORY_CANDIDATES_SCHEMA,
    }).catch(() => null);
    extracted = parseMemoryCandidates(live?.text);
  }
  if (!extracted.length) extracted = extractMemoryCandidatesOffline(input.userText);

  let entities: MemoryCandidate[] = [];
  if (input.useModel && openaiConfigured()) {
    const live = await runNyxTask({
      playerId: input.playerId,
      task: "ENTITY_EXTRACTION",
      text: `Haal 0 tot 2 genoemde relaties uit deze beurt.\nSpeler: ${input.userText}`,
      invokeModel: true,
      jsonSchema: MEMORY_CANDIDATES_SCHEMA,
    }).catch(() => null);
    entities = parseMemoryCandidates(live?.text);
  }
  if (!entities.length) entities = extractEntitiesOffline(input.userText);

  const merged = [...extracted, ...entities].slice(0, 5);
  return merged.map((candidate) => ({
    ...candidate,
    category: normalizeMemoryCategory(candidate.domain, candidate.category),
  }));
}

/** After the Nyx reply is persisted. Models never write memory rows. Campaign stays untouched. */
export async function afterNyxReply(input: {
  playerId: string;
  userText: string;
  nyxText: string;
  sourceId?: string | null;
  useModel?: boolean;
}) {
  const existing: Memory[] = await listActiveMemories(input.playerId).catch((): Memory[] => []);
  const candidates = await collectTurnCandidates(input);
  for (const candidate of candidates) {
    const decision = applyMemoryDecision(candidate, existing);
    if (!decision.ok || decision.store === "SKIP") continue;
    if (decision.campaignTouched) continue;

    const content = candidate.reasoningSummary
      ? `${candidate.normalizedFact[0]?.toUpperCase() ?? ""}${candidate.normalizedFact.slice(1)}.`
      : candidate.normalizedFact;
    const factKey = normalizeFact(candidate.normalizedFact) || candidate.normalizedFact.trim();
    const draft = {
      domain: candidate.domain,
      category: candidate.category,
      content,
      normalizedFact: factKey,
      confidence: candidate.confidence,
      importance: candidate.importance,
      sourceType: "CHAT" as const,
      sourceId: input.sourceId ?? null,
    };

    if (decision.store === "OBSERVE" && decision.existingId) {
      await bumpObservation(input.playerId, decision.existingId);
      continue;
    }
    if (decision.store === "AUTO") {
      const stored = await insertMemory(input.playerId, draft, "AI", candidate.reasoningSummary || "Stil bewaard.");
      existing.push(stored);
      continue;
    }
    if (decision.store === "PROPOSAL" || decision.store === "REVISION") {
      await createMemoryProposal(input.playerId, {
        ...draft,
        supersedesMemoryId: decision.store === "REVISION" ? decision.existingId : undefined,
      });
      if (candidate.importance === "HIGH" || candidate.importance === "CRITICAL") {
        await afterHighMemory(input.playerId).catch(() => undefined);
      }
    }
  }

  return { campaignTouched: false as const, createdMission: null };
}
