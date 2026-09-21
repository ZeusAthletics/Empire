import type { MemoryCandidate } from "@/server/ai/schemas/memory.schema";
import { normalizeMemoryCategory } from "@/server/domain/memory/categories";
import type { Memory, MemoryConfidence, MemoryDomain, MemoryImportance } from "@/server/domain/memory/types";

const CONFIDENCE_VALUES = new Set<MemoryConfidence>(["TENTATIVE", "LIKELY", "CONFIRMED", "EXPLICIT"]);
const IMPORTANCE_VALUES = new Set<MemoryImportance>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const DOMAIN_VALUES = new Set<MemoryDomain>([
  "PERSONAL",
  "CAMPAIGN",
  "STRATEGIC",
  "RELATIONSHIP",
  "PREFERENCE",
  "CONVERSATION_SUMMARY",
]);

/** Stored automatically — no Onthouden chip — so chat facts survive long threads. */
const PERSISTENT_CHAT_DOMAINS = new Set<MemoryDomain>([
  "RELATIONSHIP",
  "PREFERENCE",
  "PERSONAL",
  "CONVERSATION_SUMMARY",
]);

export type MemoryStoreAction = "AUTO" | "PROPOSAL" | "OBSERVE" | "REVISION" | "SKIP";

export type MemoryDecision = {
  ok: boolean;
  store: MemoryStoreAction;
  reason: string;
  existingId?: string;
  campaignTouched: false;
};

export function normalizeFact(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function enumKey(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeMemoryConfidence(raw: unknown): MemoryConfidence {
  const key = enumKey(raw);
  if (CONFIDENCE_VALUES.has(key as MemoryConfidence)) return key as MemoryConfidence;
  const aliases: Record<string, MemoryConfidence> = {
    HOOG: "CONFIRMED",
    HIGH: "CONFIRMED",
    MEDIUM: "LIKELY",
    MED: "LIKELY",
    GEMIDDELD: "LIKELY",
    LAAG: "TENTATIVE",
    LOW: "TENTATIVE",
    ZEKER: "EXPLICIT",
    EXPLICIET: "EXPLICIT",
    EXPLICIT: "EXPLICIT",
  };
  return aliases[key] ?? "LIKELY";
}

export function normalizeMemoryImportance(raw: unknown): MemoryImportance {
  const key = enumKey(raw);
  if (IMPORTANCE_VALUES.has(key as MemoryImportance)) return key as MemoryImportance;
  const aliases: Record<string, MemoryImportance> = {
    HOOG: "HIGH",
    HIGH: "HIGH",
    LAAG: "LOW",
    LOW: "LOW",
    GEMIDDELD: "MEDIUM",
    MEDIUM: "MEDIUM",
    MED: "MEDIUM",
    KRITIEK: "CRITICAL",
    CRITICAL: "CRITICAL",
  };
  return aliases[key] ?? "MEDIUM";
}

export function normalizeMemoryDomain(raw: unknown): MemoryDomain {
  const key = enumKey(raw);
  if (DOMAIN_VALUES.has(key as MemoryDomain)) return key as MemoryDomain;
  return "PREFERENCE";
}

/** Coerce model JSON (incl. Dutch/lowercase enums) before DB writes. */
export function sanitizeMemoryCandidate(candidate: MemoryCandidate): MemoryCandidate {
  const domain = normalizeMemoryDomain(candidate.domain);
  const confidence = normalizeMemoryConfidence(candidate.confidence);
  return {
    ...candidate,
    domain,
    category: normalizeMemoryCategory(domain, candidate.category),
    normalizedFact: normalizeFact(candidate.normalizedFact),
    confidence,
    importance: normalizeMemoryImportance(candidate.importance),
    status: normalizeMemoryConfidence(candidate.status),
    shouldStore: candidate.shouldStore !== false,
  };
}

export function validateMemoryCandidate(candidate: MemoryCandidate) {
  if (!candidate.normalizedFact.trim()) return { ok: false as const, reason: "leeg feit" };
  if (
    candidate.shouldStore &&
    PERSISTENT_CHAT_DOMAINS.has(candidate.domain) &&
    candidate.importance !== "CRITICAL"
  ) {
    return { ok: true as const, store: "AUTO" as const };
  }
  if (candidate.importance === "HIGH" || candidate.importance === "CRITICAL") {
    return { ok: true as const, store: "PROPOSAL" as const };
  }
  if (candidate.shouldStore && (candidate.importance === "LOW" || candidate.importance === "MEDIUM")) {
    return { ok: true as const, store: "AUTO" as const };
  }
  return { ok: true as const, store: "SKIP" as const };
}

export function applyMemoryDecision(
  candidate: MemoryCandidate,
  existing: Pick<Memory, "id" | "domain" | "category" | "normalizedFact" | "status">[],
): MemoryDecision {
  const fact = normalizeFact(candidate.normalizedFact);
  if (!fact) return { ok: false, store: "SKIP", reason: "leeg feit", campaignTouched: false };

  const active = existing.filter((memory) => memory.status === "ACTIVE");
  const same = active.find((memory) => memory.normalizedFact === fact);
  if (same) {
    return { ok: true, store: "OBSERVE", reason: "al bekend", existingId: same.id, campaignTouched: false };
  }

  const conflict = active.find(
    (memory) => memory.domain === candidate.domain && memory.category === candidate.category && memory.normalizedFact !== fact,
  );
  if (conflict && (candidate.importance === "HIGH" || candidate.importance === "CRITICAL")) {
    return {
      ok: true,
      store: "REVISION",
      reason: "botst met een bestaand feit",
      existingId: conflict.id,
      campaignTouched: false,
    };
  }

  const basic = validateMemoryCandidate({ ...candidate, normalizedFact: fact });
  if (!basic.ok) return { ok: false, store: "SKIP", reason: basic.reason, campaignTouched: false };
  return { ok: true, store: basic.store, reason: basic.store.toLowerCase(), campaignTouched: false };
}
