import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { storeJournalPhoto } from "@/server/domain/journal/journalMedia";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

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
    return NextResponse.json({
      ok: true,
      mediaId,
      src,
      media: {
        kind: "note",
        label: file.name.replace(/\.[^.]+$/, "") || "Foto",
        src,
        mediaId,
        approved: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
