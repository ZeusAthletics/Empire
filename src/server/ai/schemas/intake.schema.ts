import type { MemoryDomain } from "@/server/domain/memory/types";
import type { StatKey } from "@/server/domain/player/types";
import type { SideQuestProposalPayload } from "@/server/domain/nyx/proposalTypes";

export type IntakeSlots = {
  personal: boolean;
  business: boolean;
  goals: boolean;
};

export type IntakeCompile = {
  title: string;
  principles: string[];
  constraints: string[];
  energyGivers: string[];
  energyDrains: string[];
  memories: { domain: MemoryDomain; category: string; fact: string }[];
  campaign: {
    title: string;
    northStar: string;
    bottleneckStat: StatKey;
    bottleneckReason: string;
    chapterName: string;
    chapterTagline: string;
    economicCurrent: number;
    economicTo: number;
    exitCriteria: string;
  };
  missions: SideQuestProposalPayload[];
};

export const INTAKE_SLOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["personal", "business", "goals", "reply"],
  properties: {
    personal: { type: "boolean" },
    business: { type: "boolean" },
    goals: { type: "boolean" },
    reply: { type: "string" },
  },
} as const;

export const INTAKE_COMPILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "principles",
    "constraints",
    "energyGivers",
    "energyDrains",
    "memories",
    "campaign",
    "missions",
  ],
  properties: {
    title: { type: "string" },
    principles: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    energyGivers: { type: "array", items: { type: "string" } },
    energyDrains: { type: "array", items: { type: "string" } },
    memories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "category", "fact"],
        properties: {
          domain: { type: "string" },
          category: { type: "string" },
          fact: { type: "string" },
        },
      },
    },
    campaign: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "northStar",
        "bottleneckStat",
        "bottleneckReason",
        "chapterName",
        "chapterTagline",
        "economicCurrent",
        "economicTo",
        "exitCriteria",
      ],
      properties: {
        title: { type: "string" },
        northStar: { type: "string" },
        bottleneckStat: { type: "string" },
        bottleneckReason: { type: "string" },
        chapterName: { type: "string" },
        chapterTagline: { type: "string" },
        economicCurrent: { type: "number" },
        economicTo: { type: "number" },
        exitCriteria: { type: "string" },
      },
    },
    missions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "duration", "difficulty", "xp", "impact", "blueprint"],
        properties: {
          title: { type: "string" },
          duration: { type: "string" },
          difficulty: { type: "string" },
          xp: { type: "number" },
          impact: { type: "string" },
          blueprint: {
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "track",
              "why",
              "mainObjective",
              "objectives",
              "locationName",
              "locationAddress",
              "people",
              "estimate",
              "statReward",
              "evidence",
            ],
            properties: {
              kind: { type: "string" },
              track: { type: "string" },
              why: { type: "string" },
              mainObjective: { type: "string" },
              objectives: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label"],
                  properties: { label: { type: "string" } },
                },
              },
              locationName: { type: "string" },
              locationAddress: { type: "string" },
              people: { type: "array", items: { type: "string" } },
              estimate: { type: "string" },
              statReward: {
                type: "object",
                additionalProperties: false,
                required: ["key", "amount"],
                properties: {
                  key: { type: "string" },
                  amount: { type: "number" },
                },
              },
              evidence: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;
