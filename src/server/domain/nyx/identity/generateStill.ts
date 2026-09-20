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

async function refsForEdit(): Promise<NyxIdentityRef[]> {
  const all = await listIdentityRefs();
  const face = all.find((ref) => ref.role === "FACE");
  if (!face) return [];
  const rest = all.filter((ref) => ref.id !== face.id).slice(0, 3);
  return [face, ...rest];
}

export async function generateNyxStill(scene: string): Promise<ArrayBuffer | null> {
  if (!openaiConfigured()) return null;
  const refs = await refsForEdit();
  if (!refs.length) return null;

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
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    const remote = result.data?.[0]?.url;
    if (!remote) return null;
    const image = await fetch(remote, { headers: { "User-Agent": UA } });
    if (!image.ok) return null;
    return image.arrayBuffer();
  } catch {
    return null;
  }
}
