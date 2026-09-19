import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { createContact, setContactCoords } from "@/server/domain/contact/repository";
import { contactMapPin, createMapPin } from "@/server/domain/map/repository";

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
    role?: string;
    address?: string;
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
    if (body.type === "contact") {
      const contact = body.contactId
        ? await setContactCoords(player.id, body.contactId, body.lat, body.lng)
        : await createContact(player.id, {
            name: body.title ?? "",
            role: body.role,
            note: body.note,
            address: body.address,
            lat: body.lat,
            lng: body.lng,
          });
      if (contact.lat == null || contact.lng == null) {
        return NextResponse.json({ ok: false, error: "Contact bewaard, maar zonder pin." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        pin: contactMapPin({
          id: contact.id,
          name: contact.name,
          role: contact.role,
          note: contact.note,
          tier: contact.tier,
          address: contact.address,
          lat: contact.lat,
          lng: contact.lng,
        }),
      });
    }
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
