import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { NYX_IMAGE_EDIT_MODELS, parseNyxImageEditModel } from "@/server/domain/nyx/identity/imageModel";
import {
  deleteIdentityRef,
  getCanonicalFacePrompt,
  getNyxImageEditModel,
  listIdentityRefs,
  setCanonicalFacePrompt,
  setNyxImageEditModel,
  uploadIdentityRef,
  type NyxIdentityRefRole,
} from "@/server/domain/nyx/identity/repository";

export const runtime = "nodejs";

const ROLES: NyxIdentityRefRole[] = ["FACE", "BODY", "SIGNATURE_OUTFIT", "VARIANT_OK"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const [refs, facePrompt, imageEditModel] = await Promise.all([
    listIdentityRefs(),
    getCanonicalFacePrompt(),
    getNyxImageEditModel(),
  ]);
  return NextResponse.json({ ok: true, refs, facePrompt, imageEditModel });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: { facePrompt?: string; imageEditModel?: string };
  try {
    body = (await request.json()) as { facePrompt?: string; imageEditModel?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const hasFace = typeof body.facePrompt === "string";
  const hasModel = typeof body.imageEditModel === "string";
  if (!hasFace && !hasModel) {
    return NextResponse.json({ ok: false, error: "Geen velden om op te slaan." }, { status: 400 });
  }
  if (hasFace && body.facePrompt!.length > 8000) {
    return NextResponse.json({ ok: false, error: "Face prompt te lang (max 8000)." }, { status: 400 });
  }
  if (hasModel) {
    const model = parseNyxImageEditModel(body.imageEditModel);
    if (!NYX_IMAGE_EDIT_MODELS.includes(model)) {
      return NextResponse.json({ ok: false, error: "Ongeldig image model." }, { status: 400 });
    }
  }

  try {
    if (hasFace) await setCanonicalFacePrompt(body.facePrompt!);
    if (hasModel) await setNyxImageEditModel(parseNyxImageEditModel(body.imageEditModel));
    const [facePrompt, imageEditModel] = await Promise.all([getCanonicalFacePrompt(), getNyxImageEditModel()]);
    return NextResponse.json({ ok: true, facePrompt, imageEditModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const role = String(form.get("role") ?? "FACE");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand." }, { status: 400 });
  }
  if (!ROLES.includes(role as NyxIdentityRefRole)) {
    return NextResponse.json({ ok: false, error: "Ongeldige rol." }, { status: 400 });
  }

  try {
    const ref = await uploadIdentityRef({
      role: role as NyxIdentityRefRole,
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType: file.type || "image/jpeg",
      label: String(form.get("label") ?? "") || undefined,
    });
    return NextResponse.json({ ok: true, ref });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Geen id." }, { status: 400 });
  await deleteIdentityRef(id);
  return NextResponse.json({ ok: true });
}
