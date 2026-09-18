import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { createMapPin } from "@/server/domain/map/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let body: {
    title?: string;
    type?: string;
    lat?: number;
    lng?: number;
    note?: string;
    contactId?: string;
    missionId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ ok: false, error: "Coördinaten ontbreken." }, { status: 400 });
  }
  try {
    const pin = await createMapPin(player.id, {
      title: body.title ?? "Eigen pin",
      type: body.type ?? "saved",
      lat: body.lat,
      lng: body.lng,
      note: body.note,
      contactId: body.contactId,
      missionId: body.missionId,
    });
    return NextResponse.json({ ok: true, pin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pin kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
