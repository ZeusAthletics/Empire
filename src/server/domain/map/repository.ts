import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  missionPinState,
  missionPinType,
  type MapPin,
  type MapPinType,
  type MapState,
} from "@/server/domain/map/types";
import type { MissionKind } from "@/server/domain/mission/types";

const PIN_TYPES = new Set<MapPinType>([
  "home",
  "main",
  "side",
  "boss",
  "contact",
  "company",
  "event",
  "opportunity",
  "saved",
]);

export async function getMapState(playerId: string): Promise<MapState> {
  const admin = createSupabaseAdminClient();
  const [{ data: missions, error: missionError }, { data: contacts, error: contactError }, { data: companies, error: companyError }, { data: pins, error: pinError }] =
    await Promise.all([
      admin
        .from("missions")
        .select("id, title, why, kind, status, featured, xp_reward, location_name, location_address, when_label, estimate_label, lat, lng")
        .eq("player_id", playerId)
        .is("deleted_at", null),
      admin
        .from("contacts")
        .select("id, name, role, note, tier, lat, lng, restricted")
        .eq("player_id", playerId)
        .is("deleted_at", null),
      admin.from("companies").select("id, name, sector, lat, lng, note").eq("player_id", playerId).is("deleted_at", null),
      admin
        .from("map_pins")
        .select("id, title, pin_type, lat, lng, note, custom, contact_id, mission_id")
        .eq("player_id", playerId)
        .is("deleted_at", null),
    ]);
  if (missionError) throw missionError;
  if (contactError) throw contactError;
  if (companyError) throw companyError;
  if (pinError) throw pinError;

  const visibleContacts = (contacts ?? []).filter((contact) => !contact.restricted);
  const missionIds = (missions ?? []).map((mission) => mission.id as string);
  const { data: links } = missionIds.length
    ? await admin.from("mission_contacts").select("mission_id").in("mission_id", missionIds)
    : { data: [] };
  const contactCount = new Map<string, number>();
  for (const link of links ?? []) {
    contactCount.set(link.mission_id as string, (contactCount.get(link.mission_id as string) ?? 0) + 1);
  }

  const assembled: MapPin[] = [];

  for (const pin of pins ?? []) {
    assembled.push({
      id: pin.id as string,
      title: pin.title as string,
      type: (pin.pin_type as MapPinType) ?? "saved",
      lat: pin.lat as number,
      lng: pin.lng as number,
      kind: "pin",
      state: pin.pin_type === "home" ? "active" : "default",
      custom: Boolean(pin.custom),
      note: (pin.note as string | null) ?? null,
      missionId: (pin.mission_id as string | null) ?? null,
      contactId: (pin.contact_id as string | null) ?? null,
      mission: null,
      contact: null,
    });
  }

  for (const mission of missions ?? []) {
    if (mission.lat == null || mission.lng == null) continue;
    assembled.push({
      id: `mp-${mission.id}`,
      title: mission.title as string,
      type: missionPinType(mission.kind as MissionKind),
      lat: mission.lat as number,
      lng: mission.lng as number,
      kind: "mission",
      state: missionPinState(mission.status as string, Boolean(mission.featured)),
      custom: false,
      note: null,
      missionId: mission.id as string,
      contactId: null,
      mission: {
        id: mission.id as string,
        title: mission.title as string,
        why: mission.why as string,
        locationName: (mission.location_name as string | null) ?? null,
        locationAddress: (mission.location_address as string | null) ?? null,
        whenLabel: (mission.when_label as string | null) ?? null,
        estimateLabel: (mission.estimate_label as string | null) ?? null,
        xpReward: mission.xp_reward as number,
        contactCount: contactCount.get(mission.id as string) ?? 0,
        kind: mission.kind as MissionKind,
      },
      contact: null,
    });
  }

  for (const contact of visibleContacts) {
    if (contact.lat == null || contact.lng == null) continue;
    assembled.push({
      id: `cp-${contact.id}`,
      title: contact.name as string,
      type: "contact",
      lat: contact.lat as number,
      lng: contact.lng as number,
      kind: "contact",
      state: "default",
      custom: false,
      note: (contact.note as string | null) ?? null,
      missionId: null,
      contactId: contact.id as string,
      mission: null,
      contact: {
        id: contact.id as string,
        name: contact.name as string,
        role: (contact.role as string | null) ?? null,
        note: (contact.note as string | null) ?? null,
        tier: (contact.tier as string | null) ?? null,
      },
    });
  }

  for (const company of companies ?? []) {
    assembled.push({
      id: `kp-${company.id}`,
      title: company.name as string,
      type: "company",
      lat: company.lat as number,
      lng: company.lng as number,
      kind: "company",
      state: "default",
      custom: false,
      note: (company.sector as string | null) ?? (company.note as string | null) ?? null,
      missionId: null,
      contactId: null,
      mission: null,
      contact: null,
    });
  }

  return {
    pins: assembled,
    contactOptions: visibleContacts.map((contact) => ({ id: contact.id as string, title: contact.name as string })),
    missionOptions: (missions ?? [])
      .filter((mission) => mission.status !== "COMPLETED" && mission.status !== "COMPLETED_UNVERIFIED")
      .map((mission) => ({ id: mission.id as string, title: mission.title as string })),
  };
}

export async function createMapPin(
  playerId: string,
  input: {
    title: string;
    type: string;
    lat: number;
    lng: number;
    note?: string;
    contactId?: string;
    missionId?: string;
  },
): Promise<MapPin> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("Ongeldige coördinaten.");
  }
  const pinType = PIN_TYPES.has(input.type as MapPinType) ? (input.type as MapPinType) : "saved";
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("map_pins")
    .insert({
      player_id: playerId,
      title: input.title.trim() || "Eigen pin",
      pin_type: pinType,
      lat: input.lat,
      lng: input.lng,
      note: input.note?.trim() || null,
      custom: true,
      contact_id: input.contactId || null,
      mission_id: input.missionId || null,
      source: "USER",
      locked_by_admin: false,
    } as never)
    .select("id, title, pin_type, lat, lng, note, custom, contact_id, mission_id")
    .single();
  if (error || !data) throw error ?? new Error("Pin kon niet worden bewaard.");
  return {
    id: data.id as string,
    title: data.title as string,
    type: data.pin_type as MapPinType,
    lat: data.lat as number,
    lng: data.lng as number,
    kind: "pin",
    state: "default",
    custom: true,
    note: (data.note as string | null) ?? null,
    missionId: (data.mission_id as string | null) ?? null,
    contactId: (data.contact_id as string | null) ?? null,
    mission: null,
    contact: null,
  };
}

export async function deleteMapPin(playerId: string, pinId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("map_pins")
    .select("id, custom, locked_by_admin")
    .eq("id", pinId)
    .eq("player_id", playerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pin niet gevonden.");
  if (!data.custom || data.locked_by_admin) throw new Error("Deze pin kan niet worden verwijderd.");
  const { error: delError } = await admin
    .from("map_pins")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", pinId)
    .eq("player_id", playerId);
  if (delError) throw delError;
}
