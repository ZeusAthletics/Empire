import { openaiConfigured } from "@/server/ai/client/openai";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import {
  MONTHLY_WRAP_JSON_SCHEMA,
  parseMonthlyWrapNarrative,
  type MonthlyWrapNarrative,
} from "@/server/ai/schemas/monthly-wrap.schema";
import {
  collectMonthWrapFacts,
  formatEntriesForWrapPrompt,
  offlineWrapNarrative,
  type MonthWrapFacts,
} from "@/server/domain/journal/monthWrapFacts";

export async function analyzeMonthlyWrapNarrative(
  playerId: string,
  facts: MonthWrapFacts,
): Promise<MonthlyWrapNarrative> {
  if (!openaiConfigured()) {
    return offlineWrapNarrative(facts);
  }

  const prompt = `Maand: ${facts.label} (${facts.monthId})
Statistieken (server, leidend voor cijfers): events=${facts.events}, newContacts=${facts.newContacts}, missionsCompleted=${facts.missionsCompleted}, empireDelta=${facts.empireDelta}, deltas=${JSON.stringify(facts.deltas)}
Voltooide missies: ${facts.completedMissionTitles.join("; ") || "(geen)"}

Journal entries:
${formatEntriesForWrapPrompt(facts.entries)}`;

  const result = await runNyxTask({
    playerId,
    task: "MONTHLY_WRAP_ANALYSIS",
    text: prompt,
    invokeModel: true,
    jsonSchema: MONTHLY_WRAP_JSON_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null);

  return parseMonthlyWrapNarrative(result?.text ?? null) ?? offlineWrapNarrative(facts);
}

export async function buildMonthlyWrapFacts(playerId: string, monthId?: string) {
  return collectMonthWrapFacts(playerId, monthId);
}
