import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { createContact, listVisibleContacts } from "@/server/domain/contact/repository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const contacts = await listVisibleContacts(player.id);
  return NextResponse.json({ ok: true, contacts });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let body: { name?: string; role?: string; note?: string; place?: string; address?: string; lat?: number; lng?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const contact = await createContact(player.id, {
      name: body.name ?? "",
      role: body.role,
      note: body.note,
      place: body.place,
      address: body.address ?? body.place,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
    });
    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
