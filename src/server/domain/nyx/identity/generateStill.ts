import { toFile } from "openai";
import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import { buildNyxEditPrompt } from "@/server/ai/prompts/nyx-identity";
import type { NyxImageEditModel } from "@/server/domain/nyx/identity/imageModel";
import {
  downloadIdentityRefBytes,
  getCanonicalFacePrompt,
  getNyxImageEditModel,
  listIdentityRefs,
  type NyxIdentityRef,
} from "@/server/domain/nyx/identity/repository";

const UA = "EmpireMode/1.0 (nyx-still)";

function mimeForRef(ref: NyxIdentityRef): string {
  const path = ref.storagePath.toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function buildEditParams(
  model: NyxImageEditModel,
  imageFiles: Awaited<ReturnType<typeof toFile>>[],
  prompt: string,
) {
  const image = imageFiles.length === 1 ? imageFiles[0] : imageFiles;
  const shared = {
    model,
    image,
    prompt,
    size: "1024x1024" as const,
    quality: "high" as const,
    output_format: "jpeg" as const,
  };
  if (model === "gpt-image-1") {
    return { ...shared, input_fidelity: "high" as const };
  }
  return shared;
}

export type GenerateNyxStillOptions = {
  /** Admin test: only FACE ref — faster uploads to OpenAI. */
  faceRefOnly?: boolean;
};

async function refsForEdit(options?: GenerateNyxStillOptions): Promise<NyxIdentityRef[]> {
  const all = await listIdentityRefs();
  const face = all.find((ref) => ref.role === "FACE");
  if (!face) return [];
  if (options?.faceRefOnly) return [face];
  const rest = all.filter((ref) => ref.id !== face.id).slice(0, 3);
  return [face, ...rest];
}

export type GenerateNyxStillResult = {
  bytes: ArrayBuffer | null;
  error: string | null;
};

function openAiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message ?? "OpenAI images.edit mislukt.");
  }
  return "OpenAI images.edit mislukt.";
}

export async function generateNyxStill(
  scene: string,
  options?: GenerateNyxStillOptions,
): Promise<GenerateNyxStillResult> {
  if (!openaiConfigured()) {
    return { bytes: null, error: "OPENAI_API_KEY ontbreekt in Vercel." };
  }
  const refs = await refsForEdit(options);
  if (!refs.length) {
    return { bytes: null, error: "Geen FACE-referentie geüpload." };
  }

  const [facePrompt, model] = await Promise.all([getCanonicalFacePrompt(), getNyxImageEditModel()]);
  const prompt = buildNyxEditPrompt(scene, facePrompt || undefined);
  const client = getOpenAIClient();

  const imageFiles = await Promise.all(
    refs.map(async (ref, index) => {
      const bytes = await downloadIdentityRefBytes(ref);
      const ext = mimeForRef(ref) === "image/png" ? "png" : mimeForRef(ref) === "image/webp" ? "webp" : "jpg";
      return toFile(Buffer.from(bytes), `nyx-ref-${index}.${ext}`, { type: mimeForRef(ref) });
    }),
  );

  try {
    const result = await client.images.edit(buildEditParams(model, imageFiles, prompt));
    const b64 = result.data?.[0]?.b64_json;
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      return {
        bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        error: null,
      };
    }
    const remote = result.data?.[0]?.url;
    if (!remote) return { bytes: null, error: "OpenAI gaf geen beeld terug." };
    const image = await fetch(remote, { headers: { "User-Agent": UA } });
    if (!image.ok) return { bytes: null, error: "OpenAI-beeld kon niet worden gedownload." };
    return { bytes: await image.arrayBuffer(), error: null };
  } catch (error) {
    const msg = openAiErrorMessage(error);
    let hint = "";
    if (/safety system|safety_violations/i.test(msg)) {
      hint =
        model === "gpt-image-2"
          ? " GPT Image 2 weigert Nyx latex/leather vaker dan Image 1 — gebruik Image 1 voor productie; Image 2 is alleen vergelijkingstest."
          : " OpenAI safety filter — check refs en face prompt.";
    } else if (model === "gpt-image-2" && /model|does not exist|not found|access/i.test(msg)) {
      hint = " Tip: kies GPT Image 1 als je account nog geen gpt-image-2 heeft.";
    }
    return { bytes: null, error: `${msg}${hint}` };
  }
}
