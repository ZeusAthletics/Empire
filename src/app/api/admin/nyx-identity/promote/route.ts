import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { downloadNyxGalleryAssetBytes } from "@/server/domain/nyx/galleryRepository";
import { uploadIdentityRef } from "@/server/domain/nyx/identity/repository";

export const runtime = "nodejs";

/** Copy a gate-passed gallery still into identity refs as VARIANT_OK. */
export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-identity/promote");
  let body: { mediaId?: string; label?: string };
  try {
    body = (await request.json()) as { mediaId?: string; label?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const mediaId = body.mediaId?.trim();
  if (!mediaId) {
    return NextResponse.json({ ok: false, error: "mediaId ontbreekt." }, { status: 400 });
  }

  try {
    const asset = await downloadNyxGalleryAssetBytes(scoped.id, mediaId);
    const ref = await uploadIdentityRef({
      role: "VARIANT_OK",
      bytes: asset.bytes,
      filename: asset.filename,
      contentType: asset.contentType,
      label: body.label?.trim() || "Promoted from gallery",
    });
    return NextResponse.json({ ok: true, ref });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Promoveren mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
