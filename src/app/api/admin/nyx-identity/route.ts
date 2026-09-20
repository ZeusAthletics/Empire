import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import {
  deleteIdentityRef,
  getCanonicalFacePrompt,
  listIdentityRefs,
  setCanonicalFacePrompt,
  uploadIdentityRef,
  type NyxIdentityRefRole,
} from "@/server/domain/nyx/identity/repository";

export const runtime = "nodejs";

const ROLES: NyxIdentityRefRole[] = ["FACE", "BODY", "SIGNATURE_OUTFIT", "VARIANT_OK"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const [refs, facePrompt] = await Promise.all([listIdentityRefs(), getCanonicalFacePrompt()]);
  return NextResponse.json({ ok: true, refs, facePrompt });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: { facePrompt?: string };
  try {
    body = (await request.json()) as { facePrompt?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  if (typeof body.facePrompt !== "string") {
    return NextResponse.json({ ok: false, error: "facePrompt ontbreekt." }, { status: 400 });
  }
  if (body.facePrompt.length > 8000) {
    return NextResponse.json({ ok: false, error: "Face prompt te lang (max 8000)." }, { status: 400 });
  }

  try {
    await setCanonicalFacePrompt(body.facePrompt);
    const facePrompt = await getCanonicalFacePrompt();
    return NextResponse.json({ ok: true, facePrompt });
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
