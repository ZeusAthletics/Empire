export type MemoryDomain =
  | "PERSONAL"
  | "CAMPAIGN"
  | "STRATEGIC"
  | "RELATIONSHIP"
  | "PREFERENCE"
  | "CONVERSATION_SUMMARY";

export type MemoryConfidence = "TENTATIVE" | "LIKELY" | "CONFIRMED" | "EXPLICIT";
export type MemoryImportance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MemoryStatus = "ACTIVE" | "SUPERSEDED" | "REJECTED" | "ARCHIVED";
export type MemorySourceType = "CHAT" | "JOURNAL" | "MISSION" | "MANUAL" | "IMPORT";
export type MemoryChangedBy = "AI" | "USER" | "SYSTEM";

export type Memory = {
  id: string;
  playerId: string;
  seedKey: string | null;
  domain: MemoryDomain;
  category: string;
  content: string;
  normalizedFact: string;
  confidence: MemoryConfidence;
  importance: MemoryImportance;
  status: MemoryStatus;
  sourceType: MemorySourceType;
  sourceId: string | null;
  observationCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  lastReferencedAt: string | null;
  userConfirmed: boolean;
  supersedesMemoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoryDraft = {
  domain: MemoryDomain;
  category: string;
  content: string;
  normalizedFact: string;
  confidence: MemoryConfidence;
  importance: MemoryImportance;
  sourceType: MemorySourceType;
  sourceId?: string | null;
  userConfirmed?: boolean;
  supersedesMemoryId?: string | null;
  seedKey?: string | null;
};

export type MemoryChip = {
  id: string;
  label: string;
  fact: string;
};

export type MemoryProposalPayload = {
  domain: MemoryDomain;
  category: string;
  content: string;
  normalizedFact: string;
  confidence: MemoryConfidence;
  importance: MemoryImportance;
  sourceType: MemorySourceType;
  sourceId?: string | null;
  supersedesMemoryId?: string | null;
};

export type MemorySnapshot = Omit<Memory, "id" | "createdAt" | "updatedAt">;
