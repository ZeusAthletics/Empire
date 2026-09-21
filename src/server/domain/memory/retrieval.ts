import { inferMemoryFocus } from "@/server/domain/memory/focus";
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

function score(memory: Memory, queryTokens: string[], focusDomains: string[], focusCategories: string[], now = Date.now()) {
  const haystack = `${memory.domain} ${memory.category} ${memory.normalizedFact} ${memory.content}`.toLowerCase();
  const lexical =
    queryTokens.length === 0
      ? 1
      : queryTokens.some((token) => haystack.includes(token))
        ? 1.2
        : 0.75;
  const domainBoost = focusDomains.length && focusDomains.includes(memory.domain) ? 1.15 : 1;
  const categoryBoost =
    focusCategories.length &&
    (focusCategories.includes(memory.category) ||
      focusCategories.some((cat) => memory.category.includes(cat) || cat.includes(memory.category)))
      ? 1.1
      : 1;
  return (
    IMPORTANCE_WEIGHT[memory.importance] *
    CONFIDENCE_WEIGHT[memory.confidence] *
    recencyWeight(memory.lastObservedAt, now) *
    lexical *
    domainBoost *
    categoryBoost
  );
}

export function retrieveRelevantMemoriesFrom(
  memories: Memory[],
  query = "",
  now = Date.now(),
  maxItems?: number,
): Memory[] {
  const active = memories.filter((memory) => memory.status === "ACTIVE");
  const focus = inferMemoryFocus(query);
  const queryTokens = focus.tokens;
  const cap = maxItems ?? (query.trim() ? 10 : 4);
  const critical = active.filter((memory) => memory.importance === "CRITICAL");
  const rest = active.filter((memory) => memory.importance !== "CRITICAL");
  const ranked = [...rest].sort(
    (a, b) =>
      score(b, queryTokens, focus.domains, focus.categories, now) -
      score(a, queryTokens, focus.domains, focus.categories, now),
  );
  const picked = new Map<string, Memory>();
  for (const memory of [...critical, ...ranked]) {
    if (picked.size >= cap) break;
    picked.set(memory.id, memory);
  }
  return [...picked.values()];
}
