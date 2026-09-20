import { toFile } from "openai";
import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import { NYX_IDENTITY } from "@/server/ai/prompts/nyx-identity";
import {
  downloadIdentityRefBytes,
  pickRefsForGeneration,
  type NyxIdentityRef,
} from "@/server/domain/nyx/identity/repository";

const UA = "EmpireMode/1.0 (nyx-still)";

async function refBytes(refs: NyxIdentityRef[]): Promise<ArrayBuffer[]> {
  const out: ArrayBuffer[] = [];
  for (const ref of refs) {
    out.push(await downloadIdentityRefBytes(ref));
  }
  return out;
}

function buildPrompt(scene: string): string {
  return [
    NYX_IDENTITY.promptFragment,
    `Allowed variants: ${NYX_IDENTITY.allowedVariants}`,
    `Scene: ${scene}`,
    `Avoid: ${NYX_IDENTITY.forbidden}. ${NYX_IDENTITY.negativeFragment}`,
  ].join("\n");
}

export async function generateNyxStill(scene: string): Promise<ArrayBuffer | null> {
  if (!openaiConfigured()) return null;
  const refs = await pickRefsForGeneration(3);
  if (!refs.length) return null;

  const prompt = buildPrompt(scene);
  const client = getOpenAIClient();
  const bytesList = await refBytes(refs);
  const primary = bytesList[0];
  if (!primary) return null;

  const imageFile = await toFile(Buffer.from(primary), "face-ref.png", { type: "image/png" });

  try {
    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size: "1024x1024",
    });
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
