import type { MemoryCandidate } from "@/server/ai/schemas/memory.schema";
import { normalizeMemoryCategory } from "@/server/domain/memory/categories";
import { normalizeFact } from "@/server/validation/MemoryValidationService";

const GREETING = /^(goede (avond|morgen|middag)|hey|hoi|hallo|ok|oké)[\s.!?]*$/i;

function candidate(partial: Omit<MemoryCandidate, "status" | "shouldStore"> & { shouldStore?: boolean }): MemoryCandidate {
  return {
    ...partial,
    normalizedFact: normalizeFact(partial.normalizedFact),
    status: partial.confidence,
    shouldStore: partial.shouldStore ?? true,
  };
}

/** Deterministic extractor. Zero memories is the common result. */
export function extractMemoryCandidatesOffline(userText: string): MemoryCandidate[] {
  const text = userText.trim();
  if (text.length < 12 || GREETING.test(text)) return [];

  const found: MemoryCandidate[] = [];

  if (/bedrijven bouwen|tijd te verkopen|tijd verkopen/i.test(text)) {
    found.push(
      candidate({
        domain: "PREFERENCE",
        category: "WORK_RHYTHM",
        normalizedFact: "wil bedrijven bouwen in plaats van tijd te verkopen",
        confidence: "EXPLICIT",
        importance: "HIGH",
        reasoningSummary: "Expliciete voorkeur over hoe hij waarde wil creëren.",
      }),
    );
  }

  if (/vrijheid is kritiek|zonder vrijheid/i.test(text)) {
    found.push(
      candidate({
        domain: "STRATEGIC",
        category: "NORTH_STAR",
        normalizedFact: "vrijheid is kritiek",
        confidence: "CONFIRMED",
        importance: "CRITICAL",
        reasoningSummary: "Kernfeit voor de campagne, niet stil schrijven.",
      }),
    );
  }

  if (/liever koffie|houd van koffie/i.test(text)) {
    found.push(
      candidate({
        domain: "PREFERENCE",
        category: "LIFESTYLE",
        normalizedFact: "drinkt liever koffie",
        confidence: "LIKELY",
        importance: "LOW",
        reasoningSummary: "Lichte persoonlijke voorkeur.",
      }),
    );
  }

  if (/misschien wil ik|ik denk dat ik liever|ik zou misschien/i.test(text)) {
    found.push(
      candidate({
        domain: "PREFERENCE",
        category: "LIFESTYLE",
        normalizedFact: text.slice(0, 80),
        confidence: "TENTATIVE",
        importance: "LOW",
        reasoningSummary: "Tentatieve voorkeur. Raakt hoofdstuk of doelen niet.",
      }),
    );
  }

  return found.slice(0, 3);
}

export function extractEntitiesOffline(userText: string): MemoryCandidate[] {
  const text = userText.trim();
  if (text.length < 12 || GREETING.test(text)) return [];
  if (!/werk|koffie|gesprek|ken|bel|mail/i.test(text)) return [];

  const names = [
    { name: "Rita", fact: "werkt met Rita" },
    { name: "Frans", fact: "noemt Frans" },
    { name: "Mike", fact: "noemt Mike" },
  ];
  return names
    .filter((item) => new RegExp(`\\b${item.name}\\b`, "i").test(text))
    .slice(0, 2)
    .map((item) =>
      candidate({
        domain: "RELATIONSHIP",
        category: "PERSON",
        normalizedFact: item.fact,
        confidence: "LIKELY",
        importance: "LOW",
        reasoningSummary: "Genoemde relatie. Stil bewaren.",
      }),
    );
}

export function parseMemoryCandidates(raw: string | null | undefined): MemoryCandidate[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { candidates?: MemoryCandidate[] } | MemoryCandidate[];
    const list = Array.isArray(parsed) ? parsed : parsed.candidates;
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.normalizedFact === "string")
      .slice(0, 3)
      .map((item) =>
        candidate({
          domain: item.domain,
          category: normalizeMemoryCategory(item.domain, item.category || "GENERAL"),
          normalizedFact: item.normalizedFact,
          confidence: item.confidence,
          importance: item.importance,
          shouldStore: item.shouldStore,
          reasoningSummary: item.reasoningSummary || "",
        }),
      );
  } catch {
    return [];
  }
}
