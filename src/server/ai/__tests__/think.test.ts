import assert from "node:assert/strict";
import test from "node:test";
import { assessCampaignReplan } from "../../domain/campaign/replan";
import { applyReviewDecision } from "../../domain/campaign/review";
import { canTakeInterrupt } from "../../domain/notify/budget";
import { evaluatePattern } from "../../domain/pattern/thresholds";
import type { PatternObservation } from "../../domain/pattern/types";
import { getModelForTier } from "../routing/modelConfig";
import { planCampaignReview } from "../services/CampaignReviewService";
import { planCampaignReplan, planChapter, proposeChapterChange } from "../services/CampaignPlanningService";
import { planPatternDetection } from "../services/StrategicPatternService";
import { CampaignRuleError } from "../../validation/CampaignRuleEngine";
import { parseMainQuestStrategy, proposeMainQuestChange } from "../../validation/missionRuleEngine";

const TERRA = getModelForTier("BALANCED");
const SOL = getModelForTier("STRATEGIC");

const chatOnce: PatternObservation[] = [
  { type: "CHAT", id: "c1", at: "2026-09-19T08:00:00.000Z", theme: "optionality" },
];

const seededHistory: PatternObservation[] = [
  { type: "JOURNAL", id: "j2", at: "2026-08-30T08:00:00.000Z", theme: "optionality" },
  { type: "MISSION", id: "m-q4", at: "2026-09-01T08:00:00.000Z", theme: "optionality" },
  { type: "MEMORY", id: "mem-freedom", at: "2026-09-17T08:00:00.000Z", theme: "optionality" },
];

test("19 one chat is never a pattern", () => {
  assert.equal(evaluatePattern(chatOnce), "NONE");
});

test("20 seeded history of 14 days and two sources surfaces a pattern", () => {
  assert.equal(evaluatePattern(seededHistory), "SURFACED");
});

test("21 PATTERN_DETECTION stays Terra unless impact is high", () => {
  assert.equal(planPatternDetection().decision.modelTier, "BALANCED");
  assert.equal(planPatternDetection().decision.model, TERRA);
  const hot = planPatternDetection({ strategicImpact: 0.9 });
  assert.equal(hot.decision.modelTier, "STRATEGIC");
  assert.equal(hot.decision.model, SOL);
});

test("10 invalid Main Quest JSON does not persist", () => {
  const result = proposeMainQuestChange({ raw: "{not-json" });
  assert.equal(result.persisted, false);
  assert.equal(parseMainQuestStrategy("{not-json"), null);
});

test("11 admin-locked chapter is not overwritten", () => {
  assert.throws(
    () =>
      proposeChapterChange(
        {
          title: "II",
          strategicPurpose: "Nieuw",
          startConditions: [],
          targetConditions: [],
          exitCriteria: [],
          dependencies: [],
          relevantStats: [],
          strategicRisks: [],
          order: 2,
          rationale: "test",
          confidence: 0.8,
        },
        true,
      ),
    CampaignRuleError,
  );
});

test("22 accepted review can change bottleneck while the chapter stays", () => {
  const applied = applyReviewDecision(
    {
      keepBottleneck: false,
      proposedBottleneck: "strategy",
      evidence: ["patroon"],
      impactOnActiveMissions: [],
      whatStays: "Chapter I ESCAPE VELOCITY blijft staan.",
      preservedElements: ["chapter I"],
      currentChapterId: "ch-1",
    },
    { lockedByAdmin: false, bottleneckStat: "optionality", chapterId: "ch-1" },
  );
  assert.equal(applied.bottleneckStat, "strategy");
  assert.equal(applied.chapterId, "ch-1");
  assert.equal(applied.chapterDeleted, false);
});

test("23 interrupts stop when the daily budget is spent", () => {
  const now = new Date("2026-09-19T10:00:00.000Z");
  const first = [{ at: "2026-09-19T08:00:00.000Z", kind: "PATTERN" }];
  assert.equal(canTakeInterrupt([], now), true);
  assert.equal(canTakeInterrupt(first, now), false);
});

test("24 campaign replan without materiality keeps the campaign", () => {
  const quiet = assessCampaignReplan({ trigger: "CHAT" });
  assert.equal(quiet.replan, false);
  assert.equal(quiet.keepCampaign, true);
  const locked = assessCampaignReplan({ trigger: "ADMIN", lockedByAdmin: true });
  assert.equal(locked.replan, false);
});

test("25 CAMPAIGN_REVIEW stays on Sol; director tasks use Director", () => {
  const DIRECTOR = getModelForTier("DIRECTOR");
  assert.equal(planCampaignReview().decision.model, SOL);
  assert.equal(planCampaignReplan().decision.model, DIRECTOR);
  assert.equal(planChapter().decision.model, DIRECTOR);
});
