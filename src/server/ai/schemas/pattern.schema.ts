export type PatternDetectResult = {
  title: string;
  description: string;
  confidence: "TENTATIVE" | "LIKELY" | "CONFIRMED" | "EXPLICIT";
  strategicImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  relatedStats: string[];
};

export const PATTERN_DETECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patterns"],
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "confidence", "strategicImpact", "relatedStats"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          confidence: { type: "string" },
          strategicImpact: { type: "string" },
          relatedStats: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
