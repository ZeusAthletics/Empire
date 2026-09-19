import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NYX_CORE_VERSION } from "@/server/ai/prompts/nyx-core";
import type { ModelRoutingDecision } from "@/server/ai/routing/AIModelRouter";

export type NyxRunWrite = {
  playerId: string;
  requestId: string;
  decision: ModelRoutingDecision;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  fallbackUsed: boolean;
  structuredOutputValid: boolean | null;
  error?: string;
};

export async function writeNyxRun(input: NyxRunWrite) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_runs")
    .insert({
      player_id: input.playerId,
      request_id: input.requestId,
      task_type: input.decision.task,
      service: "ORCHESTRATOR",
      model: input.decision.model,
      model_tier: input.decision.modelTier,
      prompt_version: NYX_CORE_VERSION,
      routing_reason: input.decision.reason,
      reasoning_effort: input.decision.reasoningEffort,
      context_refs: [],
      risk_profile: input.decision.risk,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      latency_ms: input.latencyMs,
      fallback_used: input.fallbackUsed,
      structured_output_valid: input.structuredOutputValid,
      status: input.success ? "OK" : "ERROR",
      error: input.error ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
