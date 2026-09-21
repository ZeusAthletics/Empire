export type ModelTier = "ECONOMY" | "BALANCED" | "STRATEGIC" | "DIRECTOR";

const DEFAULT_MODELS: Record<ModelTier, string> = {
  /** Campaign/chapter planning — same deep-reasoning stack as STRATEGIC unless overridden. */
  DIRECTOR: "gpt-5.6-sol",
  STRATEGIC: "gpt-5.6-sol",
  BALANCED: "gpt-5.6-terra",
  ECONOMY: "gpt-5.6-luna",
};

/** Server-only. Never import this module from a client component. */
export function getModelForTier(tier: ModelTier): string {
  switch (tier) {
    case "DIRECTOR":
      return (
        process.env.OPENAI_MODEL_DIRECTOR?.trim() ||
        process.env.OPENAI_MODEL_STRATEGIC?.trim() ||
        DEFAULT_MODELS.DIRECTOR
      );
    case "STRATEGIC":
      return process.env.OPENAI_MODEL_STRATEGIC?.trim() || DEFAULT_MODELS.STRATEGIC;
    case "BALANCED":
      return process.env.OPENAI_MODEL_BALANCED?.trim() || DEFAULT_MODELS.BALANCED;
    case "ECONOMY":
      return process.env.OPENAI_MODEL_ECONOMY?.trim() || DEFAULT_MODELS.ECONOMY;
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}
