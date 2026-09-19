import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { geocodePlace, reverseGeocode } from "@/server/domain/geo/geocode";

export type PublicContact = {
  id: string;
  name: string;
  role: string | null;
  note: string | null;
  tier: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

const CONTACT_COLS = "id, name, role, note, tier, address, lat, lng";

export function mapContact(row: Record<string, unknown>): PublicContact {
  return {
    id: row.id as string,
    name: row.name as string,
    role: (row.role as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    tier: (row.tier as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
  };
}

export async function listVisibleContacts(playerId: string): Promise<PublicContact[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .select(CONTACT_COLS)
    .eq("player_id", playerId)
    .eq("restricted", false)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) {
    if (/address|schema cache|column/i.test(error.message)) {
      const fallback = await admin
        .from("contacts")
        .select("id, name, role, note, tier, lat, lng")
        .eq("player_id", playerId)
        .eq("restricted", false)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => mapContact(row as Record<string, unknown>));
    }
    throw error;
  }
  return (data ?? []).map((row) => mapContact(row as Record<string, unknown>));
}

export async function createContact(
  playerId: string,
  input: {
    name: string;
    role?: string;
    note?: string;
    address?: string;
    place?: string;
    lat?: number | null;
    lng?: number | null;
  },
): Promise<PublicContact> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Naam is verplicht.");

  const rawAddress = (input.address ?? input.place ?? "").trim();
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  let address: string | null = rawAddress || null;

  if (rawAddress) {
    const geo = await geocodePlace(rawAddress, { minPrecision: "street" });
    if (!geo) throw new Error("Dit adres is niet gevonden in België. Gebruik straat, nummer en gemeente.");
    lat = geo.lat;
    lng = geo.lng;
    address = geo.address;
  } else if (lat != null && lng != null) {
    const geo = await reverseGeocode(lat, lng);
    if (geo) {
      address = geo.address;
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .insert({
      player_id: playerId,
      name,
      role: input.role?.trim() || null,
      note: input.note?.trim() || null,
      address,
      lat,
      lng,
      restricted: false,
      source: "USER",
    } as never)
    .select(CONTACT_COLS)
    .single();
  if (error || !data) {
    if (error && /address|schema cache|column/i.test(error.message)) {
      throw new Error("Adreskolom ontbreekt nog in de database. Plak de Home Base SQL in Supabase.");
    }
    throw error ?? new Error("Contact kon niet worden bewaard.");
  }
  return mapContact(data as Record<string, unknown>);
}

export async function setContactCoords(playerId: string, contactId: string, lat: number, lng: number) {
  const geo = await reverseGeocode(lat, lng);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .update({
      lat: geo?.lat ?? lat,
      lng: geo?.lng ?? lng,
      address: geo?.address ?? null,
    } as never)
    .eq("id", contactId)
    .eq("player_id", playerId)
    .is("deleted_at", null)
    .select(CONTACT_COLS)
    .single();
  if (error || !data) throw error ?? new Error("Contact kon niet worden geplaatst.");
  return mapContact(data as Record<string, unknown>);
}
