import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { deleteNyxGalleryItem, listNyxGallery } from "@/server/domain/nyx/galleryRepository";

export const runtime = "nodejs";

export async function GET() {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-gallery");
  const items = await listNyxGallery(scoped.id);
  return NextResponse.json({ ok: true, items });
}

export async function DELETE(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-gallery");
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Geen id." }, { status: 400 });

  try {
    await deleteNyxGalleryItem(scoped.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verwijderen mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
