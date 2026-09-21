import { randomUUID } from "node:crypto";
import { callOpenAIResponses, openaiConfigured } from "@/server/ai/client/openai";
import { buildNyxContext } from "@/server/ai/context/NyxContextBuilder";
import { writeNyxRun } from "@/server/ai/orchestrator/nyxRuns";
import { CAMPAIGN_DIRECTOR_GUIDE } from "@/server/ai/prompts/campaign-director";
import { MISSION_PLANNER } from "@/server/ai/prompts/mission-planner";
import { INTAKE_GUIDE } from "@/server/ai/prompts/intake";
import { NYX_CASUAL_CHAT_GUIDE } from "@/server/ai/prompts/nyx-casual";
import { NYX_OUTREACH_GUIDE } from "@/server/ai/prompts/outreach";
import { NYX_RELATIONSHIP_GUIDE } from "@/server/ai/prompts/nyx-relationship";
import { NYX_CHECKIN_GUIDE } from "@/server/ai/prompts/nyx-checkin";
import { loadNyxCore } from "@/server/ai/prompts/nyx-core";
import { routeIntelligenceTask, type ModelRoutingDecision } from "@/server/ai/routing/AIModelRouter";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";
import { classifyIntelligenceTask } from "@/server/ai/routing/TaskClassifier";

export class StrategicPendingError extends Error {
  constructor(message = "Strategische taak staat in wacht. Sol wordt niet vervangen door Luna.") {
    super(message);
    this.name = "StrategicPendingError";
  }
}

export type OrchestratorInput = {
  playerId: string;
  task?: IntelligenceTask;
  text?: string;
  risk?: Partial<IntelligenceRiskProfile>;
  invokeModel?: boolean;
  jsonSchema?: Record<string, unknown>;
};

export type OrchestratorResult = {
  requestId: string;
  task: IntelligenceTask;
  decision: ModelRoutingDecision;
  context: Awaited<ReturnType<typeof buildNyxContext>>;
  text: string | null;
  runId: string | null;
  fallbackUsed: boolean;
};

function canRetry(tier: ModelRoutingDecision["modelTier"]) {
  return tier === "ECONOMY" || tier === "BALANCED";
}

const MEMORY_QUERY_TASKS = new Set<IntelligenceTask>([
  "CASUAL_CHAT",
  "NYX_EXPLANATION",
  "NYX_OUTREACH",
  "SIDE_QUEST_GENERATION",
  "HIGH_IMPACT_SIDE_QUEST",
]);

function memoryQueryForTask(task: IntelligenceTask, text?: string) {
  if (!text?.trim()) return "";
  return MEMORY_QUERY_TASKS.has(task) ? text.trim() : "";
}

export function planNyxTask(input: Pick<OrchestratorInput, "task" | "text" | "risk">): {
  task: IntelligenceTask;
  decision: ModelRoutingDecision;
} {
  const task = classifyIntelligenceTask({ task: input.task, text: input.text });
  return { task, decision: routeIntelligenceTask(task, input.risk) };
}

export async function runNyxTask(input: OrchestratorInput): Promise<OrchestratorResult> {
  const requestId = randomUUID();
  const { task, decision } = planNyxTask(input);
  const context = await buildNyxContext(input.playerId, task, memoryQueryForTask(task, input.text));
  const { core, version } = await loadNyxCore();
  const started = Date.now();
  let fallbackUsed = false;
  let text: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let structuredOutputValid: boolean | null = null;
  let success = true;
  let errorMessage: string | undefined;

  if (input.invokeModel) {
    if (!openaiConfigured()) {
      success = false;
      errorMessage = "OPENAI_API_KEY ontbreekt.";
    } else {
      const directorTasks =
        task === "CHAPTER_PLANNING" || task === "MAIN_QUEST_GENERATION" || task === "CAMPAIGN_REPLAN";
      const extra =
        directorTasks
          ? `\n\n${CAMPAIGN_DIRECTOR_GUIDE}`
          : task === "SIDE_QUEST_GENERATION" || task === "HIGH_IMPACT_SIDE_QUEST"
            ? `\n\n${MISSION_PLANNER}`
            : task === "PLAYER_INTAKE"
            ? `\n\n${INTAKE_GUIDE}`
            : task === "NYX_OUTREACH"
              ? `\n\n${NYX_OUTREACH_GUIDE}`
              : task === "NYX_RELATIONSHIP_REVIEW"
                ? `\n\n${NYX_RELATIONSHIP_GUIDE}`
              : task === "CASUAL_CHAT"
                ? `\n\n${NYX_CASUAL_CHAT_GUIDE}`
                : task === "NYX_CHECKIN"
                  ? `\n\n${NYX_CHECKIN_GUIDE}`
                  : "";
      const prompt = `${core}\n\n${version}\nTaak: ${task}\nContext: ${JSON.stringify(context)}\n\n${input.text ?? ""}${extra}`;
      const attempt = async () =>
        callOpenAIResponses({
          model: decision.model,
          input: prompt,
          reasoningEffort: decision.reasoningEffort,
          jsonSchema: input.jsonSchema,
        });
      try {
        const first = await attempt();
        text = first.text;
        inputTokens = first.inputTokens;
        outputTokens = first.outputTokens;
        structuredOutputValid = first.structuredOutputValid;
      } catch (error) {
        if (canRetry(decision.modelTier)) {
          fallbackUsed = true;
          try {
            const second = await attempt();
            text = second.text;
            inputTokens = second.inputTokens;
            outputTokens = second.outputTokens;
            structuredOutputValid = second.structuredOutputValid;
          } catch (retryError) {
            success = false;
            errorMessage = retryError instanceof Error ? retryError.message : "Modelcall mislukt.";
          }
        } else {
          success = false;
          errorMessage = error instanceof Error ? error.message : "Sol-call mislukt.";
        }
      }
    }
  }

  let runId: string | null = null;
  try {
    runId = await writeNyxRun({
      playerId: input.playerId,
      requestId,
      decision,
      latencyMs: Date.now() - started,
      inputTokens,
      outputTokens,
      success,
      fallbackUsed,
      structuredOutputValid,
      error: errorMessage,
      promptVersion: version,
    });
  } catch {
    runId = null;
  }

  if (
    input.invokeModel &&
    !success &&
    (decision.modelTier === "STRATEGIC" || decision.modelTier === "DIRECTOR")
  ) {
    throw new StrategicPendingError(errorMessage);
  }

  return { requestId, task, decision, context, text, runId, fallbackUsed };
}

export class NyxOrchestrator {
  plan(input: Pick<OrchestratorInput, "task" | "text" | "risk">) {
    return planNyxTask(input);
  }

  run(input: OrchestratorInput) {
    return runNyxTask(input);
  }
}
