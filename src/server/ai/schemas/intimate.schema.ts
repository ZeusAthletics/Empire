export type IntimateClassifyResult = {
  intimate: boolean;
  exitSignal: boolean;
};

export type IntimateRecapResult = {
  domain: "CONVERSATION_SUMMARY" | "RELATIONSHIP";
  category: string;
  normalizedFact: string;
  content: string;
};

export const INTIMATE_CLASSIFY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intimate", "exitSignal"],
  properties: {
    intimate: { type: "boolean" },
    exitSignal: { type: "boolean" },
  },
} as const;

export const INTIMATE_RECAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["domain", "category", "normalizedFact", "content"],
  properties: {
    domain: { type: "string", enum: ["CONVERSATION_SUMMARY", "RELATIONSHIP"] },
    category: { type: "string" },
    normalizedFact: { type: "string" },
    content: { type: "string" },
  },
} as const;
