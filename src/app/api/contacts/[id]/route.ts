import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { softDeleteContact } from "@/server/domain/contact/repository";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const { id } = await params;
  try {
    await softDeleteContact(player.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact kon niet worden verwijderd.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
