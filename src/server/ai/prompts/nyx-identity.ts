export const NYX_IDENTITY = {
  name: "Nyx — locked identity",
  /** Used for images.edit — face must stay identical to reference uploads. */
  editPromptPrefix: `Identity lock: the woman's FACE in the output must be the SAME person as the first reference image — identical facial geometry (eyes, nose, lips, jaw, cheekbones, skin tone, hair color, hairline, age). Do NOT generate a new face or a look-alike.

You MAY change only: facial expression and emotion, subtle head tilt, body pose, camera distance, lighting, background, outfit styling within Nyx's black-gold latex/leather look.`,
  promptFragment: `Nyx: black nail polish, gold lightning bolt necklace, black-gold wardrobe (gold latex top, black latex or leather). Photoreal, cinematic, no cartoon.`,
  allowedVariants:
    "Expression/emotion and scene may change; face identity may not.",
  forbidden:
    "different face, new person, face swap drift, different hair color, missing necklace, cartoon, watermark, text, extra faces.",
  negativeFragment:
    "different person, new face, face morph, doppelganger, blonde, red hair, cartoon, illustration, watermark",
};

export function buildNyxEditPrompt(scene: string, canonicalFacePrompt?: string): string {
  const faceCanon = canonicalFacePrompt?.trim();
  return [
    NYX_IDENTITY.editPromptPrefix,
    faceCanon
      ? `Canonical face description (must match reference image exactly — do not invent different features):\n${faceCanon}`
      : null,
    NYX_IDENTITY.promptFragment,
    `Emotion / scene (face stays identical): ${scene}`,
    `Forbidden: ${NYX_IDENTITY.forbidden}. ${NYX_IDENTITY.negativeFragment}`,
  ]
    .filter(Boolean)
    .join("\n");
}
