import type { MemoryDomain } from "@/server/domain/memory/types";

export type MemoryFocus = {
  tokens: string[];
  domains: MemoryDomain[];
  categories: string[];
};

const DOMAIN_HINTS: { domain: MemoryDomain; pattern: RegExp; categories?: string[] }[] = [
  { domain: "RELATIONSHIP", pattern: /\b(moeder|vader|partner|vrouw|man|kind|zoon|dochter|collega|baas|vriend|kennis|familie)\b/i, categories: ["PERSON", "FAMILY"] },
  { domain: "RELATIONSHIP", pattern: /\b(heet|heten|ken\s|met\s+[A-Z][a-z]{2,})\b/ },
  { domain: "PREFERENCE", pattern: /\b(liever|houd van|hou van|voorkeur|niet graag|altijd|nooit meer)\b/i, categories: ["LIFESTYLE", "FOOD_DRINK", "WORK_RHYTHM"] },
  { domain: "CONVERSATION_SUMMARY", pattern: /\b(hadden we het|besproken|onderwerp|herinner je|last time|eerder gezegd)\b/i, categories: ["TOPIC", "CONTEXT"] },
  { domain: "PERSONAL", pattern: /\b(woon|thuis|stad|routine|ochtend|avond|gezond)\b/i, categories: ["LOCATION", "ROUTINE", "HEALTH"] },
  { domain: "STRATEGIC", pattern: /\b(nordster|north star|bottleneck|hoofdstuk|doel|campagn)\b/i, categories: ["NORTH_STAR", "BOTTLENECK", "GOAL"] },
];

/** Lightweight focus from the user turn — no extra model call. */
export function inferMemoryFocus(query: string): MemoryFocus {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9àáâäèéêëìíîïòóôöùúûüç]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const domains = new Set<MemoryDomain>();
  const categories = new Set<string>();
  for (const hint of DOMAIN_HINTS) {
    if (hint.pattern.test(query)) {
      domains.add(hint.domain);
      for (const cat of hint.categories ?? []) categories.add(cat);
    }
  }
  for (const token of tokens) {
    if (token.length >= 4) categories.add(token.toUpperCase());
  }

  return {
    tokens,
    domains: [...domains],
    categories: [...categories],
  };
}
