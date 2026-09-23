import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { updateMapMarkerIcon } from "@/server/domain/map/repository";
import { listMapIconSets, loadPlayerMarkerIcons, resolveIconSrc } from "@/server/domain/map/iconSets";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  let body: { markerKey?: string; iconKey?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  const markerKey = body.markerKey?.trim();
  if (!markerKey) {
    return NextResponse.json({ ok: false, error: "Marker ontbreekt." }, { status: 400 });
  }

  const iconKey = body.iconKey === undefined || body.iconKey === "" ? null : body.iconKey;

  try {
    await updateMapMarkerIcon(player.id, markerKey, iconKey);
    const [sets, icons] = await Promise.all([listMapIconSets(false), loadPlayerMarkerIcons(player.id)]);
    const setsBySlug = new Map(sets.map((set) => [set.slug, set]));
    const savedKey = icons.get(markerKey) ?? null;
    const iconSrc = resolveIconSrc(savedKey, setsBySlug);
    return NextResponse.json({ ok: true, markerKey, iconKey: savedKey, iconSrc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Icoon kon niet worden opgeslagen.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
