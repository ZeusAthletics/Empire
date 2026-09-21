import assert from "node:assert/strict";
import test from "node:test";
import { routeIntelligenceTask } from "../routing/AIModelRouter";
import { getModelForTier } from "../routing/modelConfig";
import { planChapter } from "../services/CampaignPlanningService";
import { planMemoryExtraction } from "../services/MemoryExtractionService";
import { planMainQuest, planSideQuest } from "../services/MissionGenerationService";
import { planCasualChat } from "../services/NyxConversationService";
import { planOpportunityAnalysis } from "../services/OpportunityIntelligenceService";
import { handleCasualUserTurn } from "../fallback/nyxReply";

const LUNA = getModelForTier("ECONOMY");
const TERRA = getModelForTier("BALANCED");
const SOL = getModelForTier("STRATEGIC");
const DIRECTOR = getModelForTier("DIRECTOR");

test("1 MEMORY_EXTRACTION routes to Luna", () => {
  const { decision } = planMemoryExtraction();
  assert.equal(decision.modelTier, "ECONOMY");
  assert.equal(decision.model, LUNA);
});

test("2 CASUAL_CHAT routes to Terra", () => {
  const { decision } = planCasualChat("Goede avond");
  assert.equal(decision.modelTier, "BALANCED");
  assert.equal(decision.model, TERRA);
});

test("3 normal SIDE_QUEST_GENERATION routes to Terra", () => {
  const { decision } = planSideQuest();
  assert.equal(decision.modelTier, "BALANCED");
  assert.equal(decision.model, TERRA);
});

test("4 SIDE_QUEST_GENERATION with strategicImpact 0.95 escalates to Sol", () => {
  const { decision } = planSideQuest({ strategicImpact: 0.95 });
  assert.equal(decision.modelTier, "STRATEGIC");
  assert.equal(decision.model, SOL);
});

test("5 MAIN_QUEST_GENERATION routes to Director", () => {
  const { decision } = planMainQuest();
  assert.equal(decision.modelTier, "DIRECTOR");
  assert.equal(decision.model, DIRECTOR);
});

test("6 CHAPTER_PLANNING routes to Director", () => {
  const { decision } = planChapter();
  assert.equal(decision.modelTier, "DIRECTOR");
  assert.equal(decision.model, DIRECTOR);
});

test("7 CONTENT_FORMATTING routes to Luna", () => {
  const decision = routeIntelligenceTask("CONTENT_FORMATTING");
  assert.equal(decision.modelTier, "ECONOMY");
  assert.equal(decision.model, LUNA);
});

test("8 company acquisition with high impact and irreversibility routes to Sol", () => {
  const { decision } = planOpportunityAnalysis({
    strategicImpact: 0.95,
    irreversibility: 0.95,
  });
  assert.equal(decision.modelTier, "STRATEGIC");
  assert.equal(decision.model, SOL);
});

test("9 ordinary networking event relevance routes to Terra", () => {
  const { decision } = planOpportunityAnalysis({
    complexity: 0.2,
    strategicImpact: 0.25,
    uncertainty: 0.2,
    irreversibility: 0.1,
  });
  assert.equal(decision.modelTier, "BALANCED");
  assert.equal(decision.model, TERRA);
});

test("12 casual conversation does not create a mission", () => {
  const result = handleCasualUserTurn("Goede avond", {
    featuredTitle: "THE CONNECTOR",
    network: 86,
    economicCurrent: 64800,
  });
  assert.equal(result.createdMission, null);
  assert.ok(result.reply.length > 0);
  assert.equal(/Luna|Terra|Sol|gpt-5/i.test(result.reply), false);
});
