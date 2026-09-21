import type { MemoryDomain } from "@/server/domain/memory/types";

/** Stable labels for retrieval and extraction — not a DB enum. */
export const MEMORY_CATEGORIES: Record<MemoryDomain, readonly string[]> = {
  RELATIONSHIP: ["PERSON", "FAMILY", "COLLEAGUE", "PARTNER", "MENTOR", "MENTION"],
  PREFERENCE: ["LIFESTYLE", "FOOD_DRINK", "WORK_RHYTHM", "COMMUNICATION", "HOBBY", "MEDIA"],
  PERSONAL: ["HEALTH", "LOCATION", "ROUTINE", "BACKGROUND", "VALUE"],
  CONVERSATION_SUMMARY: ["TOPIC", "DECISION", "OPEN_LOOP", "CONTEXT"],
  STRATEGIC: ["NORTH_STAR", "BOTTLENECK", "PRIORITY", "CONSTRAINT"],
  CAMPAIGN: ["CHAPTER", "QUEST", "GOAL", "MILESTONE"],
};

export function categoriesForDomain(domain: MemoryDomain): readonly string[] {
  return MEMORY_CATEGORIES[domain] ?? ["GENERAL"];
}

export function normalizeMemoryCategory(domain: MemoryDomain, raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "GENERAL";
  const allowed = categoriesForDomain(domain);
  if ((allowed as readonly string[]).includes(cleaned)) return cleaned;
  if (domain === "RELATIONSHIP" && (cleaned === "MENTION" || cleaned === "CONTACT")) return "PERSON";
  if (domain === "CONVERSATION_SUMMARY") return "TOPIC";
  if (domain === "PREFERENCE" && cleaned === "LIFESTYLE_PREFERENCE") return "LIFESTYLE";
  return cleaned;
}

export function formatMemoryLine(domain: MemoryDomain, category: string, content: string): string {
  return `[${domain}/${category}] ${content}`;
}

export const MEMORY_EXTRACTION_GUIDE = `Domain + category (verplicht):
RELATIONSHIP/PERSON — genoemde mensen en je relatie tot hen
PREFERENCE — voedsel, ritme, hobby, communicatie (LIFESTYLE, FOOD_DRINK, WORK_RHYTHM, HOBBY, …)
CONVERSATION_SUMMARY/TOPIC — onderwerpen die jullie bespraken (kort feit)
PERSONAL — gezondheid, locatie, achtergrond, routine
STRATEGIC/CAMPAIGN — alleen expliciete noordster, bottleneck of campagnedoelen; anders PREFERENCE of TOPIC.

Bewaar personen, voorkeuren en topics met shouldStore true. Max 5 candidates per beurt.`;
