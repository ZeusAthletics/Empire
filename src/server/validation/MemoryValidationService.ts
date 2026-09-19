import type { MemoryCandidate } from "@/server/ai/schemas/memory.schema";
import type { Memory } from "@/server/domain/memory/types";

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

export function validateMemoryCandidate(candidate: MemoryCandidate) {
  if (!candidate.normalizedFact.trim()) return { ok: false as const, reason: "leeg feit" };
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
