import type { StatKey } from "@/server/domain/player/types";

export type PatternSource = "MEMORY" | "JOURNAL" | "MISSION" | "CHAT";
export type PatternStatus = "OBSERVING" | "SURFACED" | "CONFIRMED" | "DISMISSED" | "RESOLVED";
export type PatternImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PatternConfidence = "TENTATIVE" | "LIKELY" | "CONFIRMED" | "EXPLICIT";

export type PatternEvidenceRef = {
  type: PatternSource;
  id: string;
  at: string;
};

export type PatternObservation = PatternEvidenceRef & {
  theme: string;
};

export type StrategicPattern = {
  id: string;
  playerId: string;
  seedKey: string | null;
  title: string;
  description: string;
  evidenceRefs: PatternEvidenceRef[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  confidence: PatternConfidence;
  strategicImpact: PatternImpact;
  relatedStats: StatKey[];
  relatedMemoryIds: string[];
  status: PatternStatus;
  surfacedAt: string | null;
  confirmedAt: string | null;
};

export type PatternProposalPayload = {
  title: string;
  description: string;
  evidenceRefs: PatternEvidenceRef[];
  strategicImpact: PatternImpact;
  relatedStats: StatKey[];
  patternId?: string;
};

export type NyxPatternCard = {
  id: string;
  title: string;
  description: string;
};
