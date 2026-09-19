import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { getNyxTalk } from "@/server/ai/services/NyxConversationService";
import { approveCampaignReviewProposal } from "@/server/domain/nyx/proposalRepository";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  try {
    const { id } = await params;
    const applied = await approveCampaignReviewProposal(player.id, id);
    const talk = await getNyxTalk(player.id);
    return NextResponse.json({ ok: true, talk, applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review kon niet worden aanvaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
