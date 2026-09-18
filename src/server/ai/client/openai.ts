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
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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
