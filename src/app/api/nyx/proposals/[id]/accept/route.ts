import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { approveProposal } from "@/server/domain/nyx/proposalRepository";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let edits: { title?: string; xp?: number } = {};
  try {
    edits = (await request.json()) as typeof edits;
  } catch {
    edits = {};
  }
  try {
    const { id } = await params;
    const mission = await approveProposal(player.id, id, edits);
    return NextResponse.json({ ok: true, mission });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voorstel kon niet worden aanvaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
