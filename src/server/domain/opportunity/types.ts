import type { StatKey } from "@/server/domain/player/types";

export type OpportunityCategory =
  | "EVENT"
  | "PERSON"
  | "COMPANY"
  | "CONTENT"
  | "PROPERTY"
  | "ROLE"
  | "DEAL"
  | "OTHER";

export type OpportunitySource = "MANUAL" | "CALENDAR" | "EVENT_FEED" | "NEWS" | "CONTACT" | "JOURNAL" | "NYX";
export type OpportunityKind = "PERSONAL_INTEREST" | "STRATEGIC";
export type OpportunityStatus =
  | "NEW"
  | "SEEN"
  | "SAVED"
  | "DISMISSED"
  | "CONVERTED_TO_SIDE_QUEST"
  | "EXPIRED";
export type OpportunitySignalKind = "VIEWED" | "SAVED" | "DISMISSED" | "CONVERTED" | "COMPLETED" | "IGNORED";

export type ScoreBreakdown = {
  bottleneckFit: number;
  proximity: number;
  timing: number;
  relationshipFit: number;
  interestFit: number;
  noveltyPenaltyInv: number;
  hardFilters: number;
  base: number;
};

export type Opportunity = {
  id: string;
  seedKey: string | null;
  title: string;
  summary: string;
  category: OpportunityCategory;
  sourceType: OpportunitySource;
  availableFrom: string | null;
  expiresAt: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  relevanceScore: number;
  baseScore: number;
  scoreAdjustment: number;
  reasonsForRelevance: string[];
  relatedStats: StatKey[];
  relatedContactKeys: string[];
  type: OpportunityKind;
  campaignChanging: boolean;
  status: OpportunityStatus;
  scoreBreakdown: ScoreBreakdown | null;
};

export type OpportunityDraft = {
  seedKey?: string | null;
  title: string;
  summary: string;
  category: OpportunityCategory;
  sourceType?: OpportunitySource;
  availableFrom?: string | null;
  expiresAt?: string | null;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
  relatedStats: StatKey[];
  relatedContactKeys?: string[];
  type?: OpportunityKind;
  campaignChanging?: boolean;
  strategicValue?: string | null;
  urgency?: string | null;
};

export type AgendaPoint = {
  lat: number;
  lng: number;
  at: string;
};

export type ScoreContext = {
  bottleneckStat: StatKey;
  agenda: AgendaPoint[];
  knownContactKeys: string[];
  restrictedContactKeys: string[];
  dismissedCategories: OpportunityCategory[];
  categoryWeight: number;
  similarCount: number;
  now?: Date;
};
