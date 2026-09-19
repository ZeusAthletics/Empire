import type { StatKey } from "@/server/domain/player/types";

export type CampaignReviewPayload = {
  keepBottleneck: boolean;
  proposedBottleneck: StatKey | null;
  evidence: string[];
  impactOnActiveMissions: { missionId: string; recommendation: "KEEP" | "PAUSE" | "REFRAME"; why: string }[];
  whatStays: string;
  preservedElements: string[];
  currentChapterId?: string | null;
};

export const CAMPAIGN_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "keepBottleneck",
    "proposedBottleneck",
    "evidence",
    "impactOnActiveMissions",
    "whatStays",
    "preservedElements",
  ],
  properties: {
    keepBottleneck: { type: "boolean" },
    proposedBottleneck: { type: ["string", "null"] },
    evidence: { type: "array", items: { type: "string" } },
    impactOnActiveMissions: { type: "array", items: { type: "object" } },
    whatStays: { type: "string" },
    preservedElements: { type: "array", items: { type: "string" } },
    currentChapterId: { type: ["string", "null"] },
  },
} as const;
