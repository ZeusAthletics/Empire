import type { MemoryProposalPayload } from "../src/server/domain/memory/types";

export const SEED_MEMORIES = [
  {
    seedKey: "mem-freedom",
    domain: "STRATEGIC",
    category: "NORTH_STAR",
    content: "Vrijheid is kritiek.",
    normalizedFact: "vrijheid is kritiek",
    confidence: "CONFIRMED",
    importance: "CRITICAL",
    sourceType: "MANUAL",
    userConfirmed: true,
  },
  {
    seedKey: "mem-morning",
    domain: "PREFERENCE",
    category: "WORK_RHYTHM",
    content: "Werkt het liefst vroeg.",
    normalizedFact: "werkt het liefst vroeg",
    confidence: "TENTATIVE",
    importance: "LOW",
    sourceType: "CHAT",
    userConfirmed: false,
  },
] as const;

export const SEED_MEMORY_PROPOSALS: {
  seedKey: string;
  rationale: string;
  payload: MemoryProposalPayload;
}[] = [
  {
    seedKey: "nm1",
    rationale: "Expliciete voorkeur over hoe hij waarde wil creëren.",
    payload: {
      domain: "PREFERENCE",
      category: "WORK_RHYTHM",
      content: "U wilt bedrijven bouwen in plaats van uw tijd te verkopen.",
      normalizedFact: "wil bedrijven bouwen in plaats van tijd te verkopen",
      confidence: "EXPLICIT",
      importance: "HIGH",
      sourceType: "CHAT",
    },
  },
];
