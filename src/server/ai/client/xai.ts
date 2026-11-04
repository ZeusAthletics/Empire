import OpenAI from "openai";

const XAI_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_XAI_MODEL = "grok-4-1-fast-non-reasoning";

export type XaiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type XaiCallInput = {
  model?: string;
  messages: XaiChatMessage[];
};

export type XaiCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

let client: OpenAI | null = null;

function getClient() {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new Error("XAI_API_KEY ontbreekt.");
  if (!client) {
    client = new OpenAI({
      apiKey: key,
      baseURL: XAI_BASE_URL,
    });
  }
  return client;
}

export function xaiConfigured() {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function getXaiModel() {
  return process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL;
}

/** Server-only. Intimate chat turns go through this wrapper, not OpenAI. */
export async function callXaiChat(input: XaiCallInput): Promise<XaiCallResult> {
  const response = await getClient().chat.completions.create({
    model: input.model ?? getXaiModel(),
    messages: input.messages,
  });
  const text = response.choices[0]?.message?.content?.trim() ?? "";
  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}
