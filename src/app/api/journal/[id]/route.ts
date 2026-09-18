import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { deleteJournalEntry } from "@/server/domain/journal/repository";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  try {
    const { id } = await params;
    await deleteJournalEntry(player.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Entry kon niet worden verwijderd.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
