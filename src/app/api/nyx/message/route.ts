import { after, NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { afterNyxReply } from "@/server/ai/services/MemoryExtractionService";
import { getNyxTalk, sendNyxMessage } from "@/server/ai/services/NyxConversationService";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const talk = await getNyxTalk(player.id);
  return NextResponse.json({ ok: true, talk });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let text = "";
  let mediaId: string | null = null;
  let linkedUrl: string | null = null;
  try {
    const body = (await request.json()) as { text?: string; mediaId?: string; linkedUrl?: string };
    text = body.text ?? "";
    mediaId = body.mediaId?.trim() || null;
    linkedUrl = body.linkedUrl?.trim() || null;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const talk = await sendNyxMessage(player.id, { text, mediaId, linkedUrl });
    const lastNyx = [...talk.messages].reverse().find((message) => message.role === "nyx");
    after(() =>
      afterNyxReply({
        playerId: player.id,
        userText: text,
        nyxText: lastNyx?.text ?? "",
        useModel: true,
      }).catch(() => undefined),
    );
    return NextResponse.json({ ok: true, talk });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nyx kon niet antwoorden.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
