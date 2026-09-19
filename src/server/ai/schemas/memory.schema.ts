export type MemoryCandidate = {
  domain: "PERSONAL" | "CAMPAIGN" | "STRATEGIC" | "RELATIONSHIP" | "PREFERENCE" | "CONVERSATION_SUMMARY";
  category: string;
  normalizedFact: string;
  confidence: "TENTATIVE" | "LIKELY" | "CONFIRMED" | "EXPLICIT";
  importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "TENTATIVE" | "LIKELY" | "CONFIRMED" | "EXPLICIT";
  shouldStore: boolean;
  reasoningSummary: string;
};

export const MEMORY_CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "domain",
    "category",
    "normalizedFact",
    "confidence",
    "importance",
    "status",
    "shouldStore",
    "reasoningSummary",
  ],
  properties: {
    domain: { type: "string" },
    category: { type: "string" },
    normalizedFact: { type: "string" },
    confidence: { type: "string" },
    importance: { type: "string" },
    status: { type: "string" },
    shouldStore: { type: "boolean" },
    reasoningSummary: { type: "string" },
  },
} as const;

export const MEMORY_CANDIDATES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: MEMORY_CANDIDATE_SCHEMA,
    },
  },
} as const;
