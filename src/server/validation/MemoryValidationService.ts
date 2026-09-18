import type { MemoryCandidate } from "@/server/ai/schemas/memory.schema";

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
