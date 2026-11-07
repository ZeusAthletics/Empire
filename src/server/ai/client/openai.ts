import OpenAI from "openai";
import type { ReasoningEffort } from "@/server/ai/routing/AIModelRouter";

export type OpenAICallInput = {
  model: string;
  input: string;
  reasoningEffort: ReasoningEffort;
  jsonSchema?: Record<string, unknown>;
};

export type OpenAICallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  structuredOutputValid: boolean | null;
};

let client: OpenAI | null = null;

function getClient() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY ontbreekt.");
  if (!client) {
    client = new OpenAI({
      apiKey: key,
      timeout: 45_000,
      maxRetries: 0,
    });
  }
  return client;
}

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIClient() {
  return getClient();
}

/** Server-only. All model calls go through this wrapper. */
export async function callOpenAIResponses(input: OpenAICallInput): Promise<OpenAICallResult> {
  const response = await getClient().responses.create({
    model: input.model,
    input: input.input,
    ...(input.reasoningEffort !== "none" ? { reasoning: { effort: input.reasoningEffort } } : {}),
    ...(input.jsonSchema
      ? {
          text: {
            format: {
              type: "json_schema" as const,
              name: "nyx_payload",
              strict: true,
              schema: input.jsonSchema,
            },
          },
        }
      : {}),
  });

  const text = response.output_text ?? "";
  const usage = response.usage;
  return {
    text,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    structuredOutputValid: input.jsonSchema ? Boolean(text) : null,
  };
}

/** Stream output text deltas (phone sentence-flush). No JSON schema. */
export async function* streamOpenAIResponsesText(input: {
  model: string;
  input: string;
  reasoningEffort?: ReasoningEffort;
}): AsyncGenerator<string> {
  const stream = await getClient().responses.create({
    model: input.model,
    input: input.input,
    stream: true,
    ...(input.reasoningEffort && input.reasoningEffort !== "none"
      ? { reasoning: { effort: input.reasoningEffort } }
      : {}),
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta" && "delta" in event && typeof event.delta === "string") {
      yield event.delta;
    }
  }
}
