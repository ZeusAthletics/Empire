import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { storeChatAttachment } from "@/server/domain/nyx/chatAttachmentRepository";

export const runtime = "nodejs";

const ALLOWED = [
  /^image\//,
  /^text\//,
  /^application\/pdf$/,
  /^application\/json$/,
];

function allowedType(type: string, name: string): boolean {
  if (ALLOWED.some((re) => re.test(type))) return true;
  return /\.(png|jpe?g|webp|gif|pdf|txt|md|csv|json)$/i.test(name);
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand." }, { status: 400 });
  }
  if (!allowedType(file.type || "", file.name)) {
    return NextResponse.json(
      { ok: false, error: "Type niet ondersteund. Gebruik afbeelding, PDF of tekst." },
      { status: 400 },
    );
  }

  try {
    const mediaId = await storeChatAttachment({
      playerId: player.id,
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ ok: true, mediaId, src: `/api/media/${mediaId}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
