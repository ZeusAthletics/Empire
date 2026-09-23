import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { appendWrapPhoto } from "@/server/domain/journal/repository";
import { storeJournalPhoto } from "@/server/domain/journal/journalMedia";
import type { JournalMedia } from "@/server/domain/journal/types";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const { id: monthId } = await params;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand." }, { status: 400 });
  }

  try {
    const { mediaId, src } = await storeJournalPhoto({
      playerId: player.id,
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType: file.type || "image/jpeg",
    });
    const item: JournalMedia = {
      kind: "note",
      label: file.name.replace(/\.[^.]+$/, "") || "Foto",
      src,
      mediaId,
      approved: true,
    };
    const wrap = await appendWrapPhoto(player.id, monthId, item);
    return NextResponse.json({ ok: true, wrap, media: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
