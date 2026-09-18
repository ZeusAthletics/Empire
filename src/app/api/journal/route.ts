import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { createJournalEntry, getJournalState } from "@/server/domain/journal/repository";
import type { JournalMedia } from "@/server/domain/journal/types";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const state = await getJournalState(player.id);
  return NextResponse.json({ ok: true, ...state });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let body: {
    body?: string;
    locationName?: string;
    missionId?: string;
    tags?: string[];
    media?: JournalMedia[];
    icon?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const entry = await createJournalEntry(player.id, {
      body: body.body ?? "",
      locationName: body.locationName,
      missionId: body.missionId,
      tags: body.tags,
      media: body.media,
      icon: body.icon,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notitie kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
