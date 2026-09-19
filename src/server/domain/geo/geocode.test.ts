import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBelgianAddress,
  inBelgium,
  looksLikeStreetQuery,
  matchKnownPlace,
  pickBestHit,
  precisionOf,
  resolveMissionLocation,
  type NominatimHit,
} from "./geocode";
import { matchContactKeys } from "@/server/domain/contact/match";

test("known Kempen towns resolve without a network call", () => {
  const geel = matchKnownPlace("VOKA EVENT — GEEL");
  assert.ok(geel);
  assert.equal(geel.label, "Geel");
  assert.equal(geel.precision, "town");
  assert.ok(inBelgium(geel.lat, geel.lng));

  const heist = matchKnownPlace("Heist-op-den-Berg");
  assert.equal(heist?.label, "Heist-op-den-Berg");
});

test("remote or empty locations stay unpinned", () => {
  assert.equal(matchKnownPlace("online via Zoom"), null);
  assert.equal(matchKnownPlace(""), null);
});

test("a house number query is treated as a street address", () => {
  assert.equal(looksLikeStreetQuery("Lambertzlaan 10, Geel"), true);
  assert.equal(looksLikeStreetQuery("Geel"), false);
});

test("Nominatim hits with a house number beat a town centroid", () => {
  const rows: NominatimHit[] = [
    {
      lat: "51.1656",
      lon: "4.9906",
      class: "place",
      type: "town",
      address: { town: "Geel", postcode: "2440" },
      display_name: "Geel, België",
    },
    {
      lat: "51.1737",
      lon: "4.9901",
      class: "building",
      type: "yes",
      address: { road: "Lambertzlaan", house_number: "10", town: "Geel", postcode: "2440" },
      display_name: "Lambertzlaan 10, 2440 Geel, België",
    },
  ];
  const best = pickBestHit(rows);
  assert.equal(best?.precision, "house");
  assert.equal(best?.address, "Lambertzlaan 10, 2440 Geel");
  assert.equal(precisionOf(rows[1]), "house");
  assert.equal(formatBelgianAddress(rows[1]), "Lambertzlaan 10, 2440 Geel");
});

test("bogus coordinates outside Belgium are ignored when a place name exists", async () => {
  const pin = await resolveMissionLocation({
    locationName: "Mechelen",
    lat: 40.7,
    lng: -74.0,
    fetcher: async () => new Response("[]", { status: 200 }),
  });
  assert.equal(pin?.label, "Mechelen");
  assert.ok(pin && inBelgium(pin.lat, pin.lng));
});

test("unresolvable locations do not invent a pin", async () => {
  const pin = await resolveMissionLocation({
    locationName: "online",
    lat: 0,
    lng: 0,
  });
  assert.equal(pin, null);
});

test("people match by seed key, id, and first name", () => {
  const contacts = [
    { id: "uuid-rita", seed_key: "c-rita", name: "Rita" },
    { id: "uuid-pieter", seed_key: "c-pieter", name: "Pieter Jan" },
  ];
  assert.deepEqual(matchContactKeys(["c-rita", "Pieter"], contacts), ["uuid-rita", "uuid-pieter"]);
  assert.deepEqual(matchContactKeys(["Rita"], contacts), ["uuid-rita"]);
});
