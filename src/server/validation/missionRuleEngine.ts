import type { MainQuestStrategy } from "@/server/ai/schemas/mission.schema";

export class RestrictedContactError extends Error {
  constructor() {
    super("Restricted contact mag geen doel van een missie zijn.");
    this.name = "RestrictedContactError";
  }
}

export class MainQuestRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MainQuestRuleError";
  }
}

export function assertNoRestrictedTargets(
  contacts: { id: string; restricted: boolean }[],
  targetIds: string[],
) {
  const blocked = new Set(contacts.filter((contact) => contact.restricted).map((contact) => contact.id));
  if (targetIds.some((id) => blocked.has(id))) {
    throw new RestrictedContactError();
  }
}

export function parseMainQuestStrategy(raw: string): MainQuestStrategy | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MainQuestStrategy>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.mainObjective?.trim() || !parsed.strategicReason?.trim()) return null;
    if (!Array.isArray(parsed.objectives) || parsed.objectives.length < 2) return null;
    return parsed as MainQuestStrategy;
  } catch {
    return null;
  }
}

export function formatMainQuestTitle(objective: string) {
  return objective
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    .toUpperCase();
}

export function validateMainQuestStrategy(
  strategy: MainQuestStrategy,
  contacts: { id: string; restricted: boolean }[] = [],
) {
  if (!strategy.mainObjective.trim() || !strategy.strategicReason.trim()) {
    throw new MainQuestRuleError("Main-quest JSON is onvolledig.");
  }
  const people = Array.isArray(strategy.currentState?.contactIds)
    ? (strategy.currentState.contactIds as string[])
    : [];
  assertNoRestrictedTargets(contacts, people);
}

export function proposeMainQuestChange(input: {
  raw?: string;
  strategy?: MainQuestStrategy;
  lockedByAdmin?: boolean;
  contacts?: { id: string; restricted: boolean }[];
}) {
  const strategy = input.strategy ?? (input.raw ? parseMainQuestStrategy(input.raw) : null);
  if (!strategy) {
    return { persisted: false as const, reason: "ongeldige JSON", payload: null };
  }
  validateMainQuestStrategy(strategy, input.contacts ?? []);
  const payload = {
    title: formatMainQuestTitle(strategy.mainObjective),
    strategy: {
      ...strategy,
      ...(input.lockedByAdmin ? { currentState: { ...strategy.currentState, skippedLockedFields: true } } : {}),
    },
    skippedLockedFields: Boolean(input.lockedByAdmin),
  };
  return { persisted: true as const, reason: "proposal", payload };
}
