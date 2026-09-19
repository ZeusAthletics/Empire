import { TOWNS } from "@/features/map/pinMeta";
import { HOME_BASE } from "@/server/domain/map/types";

const EXTRA = [
  { n: "Kempen", lat: 51.12, lng: 4.83 },
  { n: "Antwerpen", lat: 51.2194, lng: 4.4025 },
  { n: "Leuven", lat: 50.8798, lng: 4.7005 },
  { n: "Turnhout", lat: 51.3227, lng: 4.9378 },
  { n: "Mol", lat: 51.1914, lng: 5.1166 },
  { n: "Heist", lat: HOME_BASE.lat, lng: HOME_BASE.lng },
];

const PLACES = [...TOWNS, ...EXTRA];
const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "EmpireMode/1.0 (hardwig-empire-mode)";

export type GeoPrecision = "house" | "street" | "venue" | "town";

export type GeoPoint = {
  lat: number;
  lng: number;
  label: string;
  address: string;
  precision: GeoPrecision;
};

export type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
};

export type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: NominatimAddress;
};

const PRECISION_RANK: Record<GeoPrecision, number> = {
  town: 1,
  venue: 2,
  street: 3,
  house: 4,
};

export function inBelgium(lat: number, lng: number) {
  return lat >= 49.45 && lat <= 51.55 && lng >= 2.5 && lng <= 6.45;
}

export function isRemoteLocation(query: string) {
  return /online|zoom|teams|remote|thuis zonder/i.test(query.trim());
}

export function looksLikeStreetQuery(query: string) {
  return /\d/.test(query) && query.trim().length >= 5;
}

export function matchKnownPlace(query: string): GeoPoint | null {
  const q = query.trim().toLowerCase();
  if (!q || isRemoteLocation(q)) return null;
  const exact = PLACES.find((place) => q === place.n.toLowerCase());
  if (exact) return townPoint(exact.n, exact.lat, exact.lng);
  const contained = PLACES.filter((place) => q.includes(place.n.toLowerCase())).sort(
    (a, b) => b.n.length - a.n.length,
  )[0];
  if (contained) return townPoint(contained.n, contained.lat, contained.lng);
  return null;
}

export function precisionOf(hit: NominatimHit): GeoPrecision {
  const address = hit.address ?? {};
  const road = address.road || address.pedestrian;
  if (address.house_number && road) return "house";
  if (address.house_number) return "house";
  if (["building", "amenity", "shop", "office", "tourism", "leisure"].includes(hit.class ?? "")) return "venue";
  if (road) return "street";
  if (["city", "town", "village", "municipality", "administrative"].includes(hit.type ?? hit.addresstype ?? "")) {
    return "town";
  }
  return "venue";
}

export function formatBelgianAddress(hit: NominatimHit): string {
  const address = hit.address ?? {};
  const street = [address.road || address.pedestrian, address.house_number].filter(Boolean).join(" ");
  const city = address.city || address.town || address.village || address.municipality;
  const line2 = [address.postcode, city].filter(Boolean).join(" ");
  const formatted = [street, line2].filter(Boolean).join(", ");
  return formatted || hit.display_name?.replace(/, België.*$/i, "").trim() || "België";
}

export function pickBestHit(rows: NominatimHit[]): GeoPoint | null {
  const ranked = rows
    .map((row) => toPoint(row))
    .filter((point): point is GeoPoint => Boolean(point))
    .sort((a, b) => PRECISION_RANK[b.precision] - PRECISION_RANK[a.precision]);
  return ranked[0] ?? null;
}

function townPoint(label: string, lat: number, lng: number): GeoPoint {
  return { lat, lng, label, address: label, precision: "town" };
}

function toPoint(row: NominatimHit): GeoPoint | null {
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBelgium(lat, lng)) return null;
  const address = formatBelgianAddress(row);
  const precision = precisionOf(row);
  return {
    lat,
    lng,
    label: address,
    address,
    precision,
  };
}

async function nominatimJson(url: URL, fetcher: typeof fetch): Promise<NominatimHit[]> {
  const response = await fetcher(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as NominatimHit | NominatimHit[];
  return Array.isArray(data) ? data : data ? [data] : [];
}

export async function searchNominatim(query: string, fetcher: typeof fetch = fetch): Promise<GeoPoint | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", /belgi/i.test(q) ? q : `${q}, België`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "be");
  try {
    return pickBestHit(await nominatimJson(url, fetcher));
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
): Promise<GeoPoint | null> {
  if (!inBelgium(lat, lng)) return null;
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  try {
    const rows = await nominatimJson(url, fetcher);
    return pickBestHit(rows) ?? { lat, lng, label: "België", address: "België", precision: "town" };
  } catch {
    return { lat, lng, label: "België", address: "België", precision: "town" };
  }
}

export async function geocodePlace(
  query: string,
  opts: { minPrecision?: GeoPrecision; fetcher?: typeof fetch } = {},
): Promise<GeoPoint | null> {
  if (isRemoteLocation(query)) return null;
  const q = query.trim();
  if (q.length < 3) return null;

  const min = PRECISION_RANK[opts.minPrecision ?? "town"];
  const known = matchKnownPlace(q);
  const exactTown = Boolean(known && q.toLowerCase() === known.label.toLowerCase());

  if (!exactTown) {
    const hit = await searchNominatim(q, opts.fetcher);
    if (hit && PRECISION_RANK[hit.precision] >= min) return hit;
    if (looksLikeStreetQuery(q) && min >= PRECISION_RANK.street) return hit && PRECISION_RANK[hit.precision] >= min ? hit : null;
    if (hit && PRECISION_RANK[hit.precision] >= PRECISION_RANK.venue) return hit;
  }

  if (known && PRECISION_RANK.town >= min) return known;
  return null;
}

export async function resolveMissionLocation(input: {
  locationName?: string | null;
  locationAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  contactPoints?: { lat: number; lng: number; address?: string | null }[];
  fetcher?: typeof fetch;
}): Promise<GeoPoint | null> {
  const fetcher = input.fetcher ?? fetch;
  let townFallback: GeoPoint | null = null;

  if (input.locationAddress?.trim()) {
    const street = await geocodePlace(input.locationAddress, { minPrecision: "street", fetcher });
    if (street) return street;
    const loose = await geocodePlace(input.locationAddress, { fetcher });
    if (loose && loose.precision !== "town") return loose;
    if (loose) townFallback = loose;
  }

  const named = [input.locationAddress, input.locationName].filter(Boolean).join(", ");
  if (named.trim() && named.trim() !== input.locationAddress?.trim()) {
    const fromName = await geocodePlace(named, { fetcher });
    if (fromName && fromName.precision !== "town") return fromName;
    if (fromName) townFallback = townFallback ?? fromName;
  } else if (input.locationName?.trim() && !input.locationAddress?.trim()) {
    const fromName = await geocodePlace(input.locationName, { fetcher });
    if (fromName && fromName.precision !== "town") return fromName;
    if (fromName) townFallback = fromName;
  }

  const contactWithAddress = input.contactPoints?.find((point) => point.address && looksLikeStreetQuery(point.address));
  if (contactWithAddress?.address) {
    const fromContact = await geocodePlace(contactWithAddress.address, { minPrecision: "street", fetcher });
    if (fromContact) return fromContact;
    if (inBelgium(contactWithAddress.lat, contactWithAddress.lng)) {
      return (
        (await reverseGeocode(contactWithAddress.lat, contactWithAddress.lng, fetcher)) ?? {
          lat: contactWithAddress.lat,
          lng: contactWithAddress.lng,
          label: contactWithAddress.address,
          address: contactWithAddress.address,
          precision: "house",
        }
      );
    }
  }

  if (typeof input.lat === "number" && typeof input.lng === "number" && inBelgium(input.lat, input.lng)) {
    const reversed = await reverseGeocode(input.lat, input.lng, fetcher);
    if (reversed) return reversed;
  }

  const contact = input.contactPoints?.find((point) => inBelgium(point.lat, point.lng));
  if (contact) {
    return (
      (await reverseGeocode(contact.lat, contact.lng, fetcher)) ?? {
        lat: contact.lat,
        lng: contact.lng,
        label: contact.address?.trim() || input.locationName?.trim() || "Contact",
        address: contact.address?.trim() || input.locationName?.trim() || "Contact",
        precision: "town",
      }
    );
  }

  return townFallback;
}
