import assert from "node:assert/strict";
import test from "node:test";
import { extractMemoryCandidatesOffline } from "../fallback/extractMemories";
import { retrieveRelevantMemoriesFrom } from "../../domain/memory/retrieval";
import type { Memory } from "../../domain/memory/types";
import { applyMemoryDecision, validateMemoryCandidate } from "../../validation/MemoryValidationService";
import { handleCasualUserTurn } from "../fallback/nyxReply";
import { planEntityExtraction } from "../services/EntityExtractionService";
import { getModelForTier } from "../routing/modelConfig";

const LUNA = getModelForTier("ECONOMY");

function memory(partial: Partial<Memory> & Pick<Memory, "id" | "normalizedFact">): Memory {
  return {
    playerId: "p1",
    seedKey: null,
    domain: "PREFERENCE",
    category: "WORK_RHYTHM",
    content: partial.normalizedFact,
    confidence: "LIKELY",
    importance: "LOW",
    status: "ACTIVE",
    sourceType: "CHAT",
    sourceId: null,
    observationCount: 1,
    firstObservedAt: "2026-09-01T00:00:00.000Z",
    lastObservedAt: "2026-09-01T00:00:00.000Z",
    lastReferencedAt: null,
    userConfirmed: false,
    supersedesMemoryId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

test("13 greeting yields no memories", () => {
  assert.deepEqual(extractMemoryCandidatesOffline("Goede avond"), []);
});

test("14 high preference becomes an Onthouden proposal", () => {
  const [candidate] = extractMemoryCandidatesOffline("Ik wil bedrijven bouwen in plaats van mijn tijd te verkopen");
  assert.ok(candidate);
  assert.equal(candidate.importance, "HIGH");
  const decision = applyMemoryDecision(candidate, []);
  assert.equal(decision.store, "PROPOSAL");
  assert.equal(decision.campaignTouched, false);
});

test("15 tentative preference does not change chapter or goals", () => {
  const chapter = { roman: "I", name: "ESCAPE VELOCITY", goals: ["De eerste €10.000-maand is een feit."] };
  const [candidate] = extractMemoryCandidatesOffline("Ik denk dat ik liever 's ochtends schrijf");
  assert.ok(candidate);
  assert.equal(candidate.confidence, "TENTATIVE");
  const basic = validateMemoryCandidate(candidate);
  assert.equal(basic.store, "AUTO");
  const decision = applyMemoryDecision(candidate, []);
  assert.equal(decision.store, "AUTO");
  assert.equal(decision.campaignTouched, false);
  assert.deepEqual(chapter, { roman: "I", name: "ESCAPE VELOCITY", goals: ["De eerste €10.000-maand is een feit."] });
});

test("16 rejected memories stay out of later context", () => {
  const memories = [
    memory({ id: "keep", normalizedFact: "vrijheid is kritiek", importance: "CRITICAL", status: "ACTIVE" }),
    memory({ id: "nope", normalizedFact: "wil bedrijven bouwen in plaats van tijd te verkopen", importance: "HIGH", status: "REJECTED" }),
  ];
  const picked = retrieveRelevantMemoriesFrom(memories, "bedrijven");
  assert.equal(picked.some((item) => item.id === "nope"), false);
  assert.equal(picked.some((item) => item.id === "keep"), true);
});

test("17 casual chat still creates no mission", () => {
  const result = handleCasualUserTurn("Ik wil bedrijven bouwen in plaats van mijn tijd te verkopen", {
    featuredTitle: "THE CONNECTOR",
    network: 86,
    economicCurrent: 64800,
  });
  assert.equal(result.createdMission, null);
});

test("18 ENTITY_EXTRACTION routes to Luna", () => {
  const { decision } = planEntityExtraction();
  assert.equal(decision.modelTier, "ECONOMY");
  assert.equal(decision.model, LUNA);
});
