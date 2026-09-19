import type { CampaignReviewPayload } from "../src/server/ai/schemas/campaign-review.schema";
import type { PatternEvidenceRef, PatternImpact } from "../src/server/domain/pattern/types";
import type { StatKey } from "../src/server/domain/player/types";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export const SEED_PATTERN = {
  seedKey: "theme:optionality",
  title: "OPTIONALITY BLIJFT DE REM",
  description: "Journal, missie en memory over twee weken wijzen naar te weinig paden naast het huidige aanbod.",
  evidenceRefs: [
    { type: "JOURNAL", id: "j2", at: daysAgo(20) },
    { type: "MISSION", id: "m-q4", at: daysAgo(18) },
    { type: "MEMORY", id: "mem-freedom", at: daysAgo(2) },
  ] as PatternEvidenceRef[],
  confidence: "LIKELY" as const,
  strategicImpact: "HIGH" as PatternImpact,
  relatedStats: ["optionality"] as StatKey[],
  status: "SURFACED" as const,
};

export const SEED_PATTERN_PROPOSAL = {
  seedKey: "np1",
  rationale: "Drie bronnen, veertien dagen, twee types. Een gesprek is dit niet.",
  payload: {
    title: SEED_PATTERN.title,
    description: SEED_PATTERN.description,
    evidenceRefs: SEED_PATTERN.evidenceRefs,
    strategicImpact: SEED_PATTERN.strategicImpact,
    relatedStats: SEED_PATTERN.relatedStats,
  },
};

export const SEED_REVIEW_PROPOSAL: {
  seedKey: string;
  rationale: string;
  payload: CampaignReviewPayload;
} = {
  seedKey: "nr1",
  rationale: "Bevestigd patroon met hoge impact. Bottleneck herijken, hoofdstuk I bewaren.",
  payload: {
    keepBottleneck: false,
    proposedBottleneck: "strategy",
    evidence: ["19 sep 2026 — optionality blijft de rem over journal, missie en memory."],
    impactOnActiveMissions: [],
    whatStays: "Chapter I ESCAPE VELOCITY blijft staan.",
    preservedElements: ["chapter I", "north star", "economic span"],
  },
};
