import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { parseEmpireDelta } from "@/server/domain/empire/apply";
import { recordEmpireDelta } from "@/server/domain/empire/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let body: { amount?: unknown; sign?: "plus" | "min"; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const delta = parseEmpireDelta(body.amount, body.sign === "min" ? "min" : "plus");
    const state = await recordEmpireDelta(player.id, delta, body.note);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Empire value kon niet worden bijgewerkt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
