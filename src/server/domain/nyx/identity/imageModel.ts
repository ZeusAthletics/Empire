export const NYX_IMAGE_EDIT_MODELS = ["gpt-image-1", "gpt-image-2"] as const;
export type NyxImageEditModel = (typeof NYX_IMAGE_EDIT_MODELS)[number];

export const DEFAULT_NYX_IMAGE_EDIT_MODEL: NyxImageEditModel = "gpt-image-1";

export function parseNyxImageEditModel(value: string | null | undefined): NyxImageEditModel {
  if (value === "gpt-image-2") return "gpt-image-2";
  return DEFAULT_NYX_IMAGE_EDIT_MODEL;
}

export const NYX_IMAGE_EDIT_MODEL_LABELS: Record<NyxImageEditModel, string> = {
  "gpt-image-1": "GPT Image 1 — Nyx latex/leather (aanbevolen)",
  "gpt-image-2": "GPT Image 2 — vergelijking (safety kan weigeren)",
};
