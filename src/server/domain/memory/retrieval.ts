import type { Memory, MemoryConfidence, MemoryImportance } from "@/server/domain/memory/types";

const IMPORTANCE_WEIGHT: Record<MemoryImportance, number> = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.8,
  CRITICAL: 1,
};

const CONFIDENCE_WEIGHT: Record<MemoryConfidence, number> = {
  TENTATIVE: 0.25,
  LIKELY: 0.5,
  CONFIRMED: 0.8,
  EXPLICIT: 1,
};

function recencyWeight(iso: string, now = Date.now()) {
  const ageDays = Math.max(0, (now - new Date(iso).getTime()) / 86_400_000);
  return 1 / (1 + ageDays / 30);
}

function score(memory: Memory, queryTokens: string[], now = Date.now()) {
  const lexical =
    queryTokens.length === 0
      ? 1
      : queryTokens.some((token) => memory.normalizedFact.includes(token) || memory.content.toLowerCase().includes(token))
        ? 1.15
        : 0.85;
  return (
    IMPORTANCE_WEIGHT[memory.importance] *
    CONFIDENCE_WEIGHT[memory.confidence] *
    recencyWeight(memory.lastObservedAt, now) *
    lexical
  );
}

export function retrieveRelevantMemoriesFrom(memories: Memory[], query = "", now = Date.now()): Memory[] {
  const active = memories.filter((memory) => memory.status === "ACTIVE");
  const queryTokens = query
    .toLowerCase()
    .split(/[^a-z0-9àáâäèéêëìíîïòóôöùúûüç]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  const critical = active.filter((memory) => memory.importance === "CRITICAL");
  const rest = active.filter((memory) => memory.importance !== "CRITICAL");
  const ranked = [...rest].sort((a, b) => score(b, queryTokens, now) - score(a, queryTokens, now));
  const picked = new Map<string, Memory>();
  for (const memory of [...critical, ...ranked]) {
    if (picked.size >= 12) break;
    picked.set(memory.id, memory);
  }
  return [...picked.values()];
}
