import type { MissionKind } from "@/server/domain/mission/types";

export type MapPinType =
  | "home"
  | "main"
  | "side"
  | "boss"
  | "contact"
  | "company"
  | "event"
  | "opportunity"
  | "saved";

export type MapPinKind = "pin" | "mission" | "contact" | "company";
export type MapPinState = "default" | "active" | "completed" | "locked";
export type MapFilter = "all" | "missions" | "contacts" | "companies" | "events" | "mine";

export type MapPinMission = {
  id: string;
  title: string;
  why: string;
  locationName: string | null;
  locationAddress: string | null;
  whenLabel: string | null;
  estimateLabel: string | null;
  xpReward: number;
  contactCount: number;
  kind: "MAIN" | "BOSS" | "EVENT" | "BUSINESS" | "CONTENT" | "NETWORK" | "OPPORTUNITY";
};

export type MapPinContact = {
  id: string;
  name: string;
  role: string | null;
  note: string | null;
  tier: string | null;
  address: string | null;
};

export type MapPin = {
  id: string;
  title: string;
  type: MapPinType;
  lat: number;
  lng: number;
  kind: MapPinKind;
  state: MapPinState;
  custom: boolean;
  note: string | null;
  missionId: string | null;
  contactId: string | null;
  mission: MapPinMission | null;
  contact: MapPinContact | null;
};

export type MapOption = { id: string; title: string };

export type HomeBase = { lat: number; lng: number; address: string };

export type MapState = {
  pins: MapPin[];
  home: HomeBase | null;
  contactOptions: MapOption[];
  missionOptions: MapOption[];
};

export const HOME_BASE = { lat: 51.0764, lng: 4.7283 };

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

export function filterPins(pins: MapPin[], filter: MapFilter) {
  if (filter === "all") return pins;
  if (filter === "missions") return pins.filter((pin) => pin.kind === "mission" || pin.type === "home");
  if (filter === "contacts") return pins.filter((pin) => pin.kind === "contact");
  if (filter === "companies") return pins.filter((pin) => pin.kind === "company");
  if (filter === "events") return pins.filter((pin) => pin.type === "event");
  if (filter === "mine") return pins.filter((pin) => pin.custom);
  return pins;
}

export function missionPinType(kind: MissionKind): MapPinType {
  if (kind === "BOSS") return "boss";
  if (kind === "MAIN") return "main";
  if (kind === "EVENT") return "event";
  if (kind === "OPPORTUNITY") return "opportunity";
  return "side";
}

export function missionPinState(status: string, featured: boolean): MapPinState {
  if (status === "COMPLETED" || status === "COMPLETED_UNVERIFIED") return "completed";
  if (status === "LOCKED") return "locked";
  if (status === "ACTIVE" && featured) return "active";
  return "default";
}
