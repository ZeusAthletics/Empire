import type { OpportunityDraft } from "../src/server/domain/opportunity/types";

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export const SEED_OPPORTUNITIES: OpportunityDraft[] = [
  {
    seedKey: "op-geel",
    title: "VOKA EVENT — GEEL",
    summary: "Netwerkavond in Geel. Connectors die u al kent, geen koude zaal.",
    category: "EVENT",
    sourceType: "MANUAL",
    availableFrom: daysFromNow(5),
    locationName: "Geel",
    lat: 51.1656,
    lng: 4.9906,
    relatedStats: ["network", "optionality"],
    relatedContactKeys: ["c-frans"],
    type: "STRATEGIC",
    campaignChanging: false,
    urgency: "HIGH",
  },
  {
    seedKey: "op-acquire",
    title: "OVERNAME PRODUCTIEHAL",
    summary: "Kleine productiehal te koop. Campagne-wijzigend, geen automatische missie.",
    category: "DEAL",
    sourceType: "MANUAL",
    availableFrom: daysFromNow(21),
    locationName: "Herentals",
    lat: 51.176,
    lng: 4.836,
    relatedStats: ["ownership", "capital"],
    relatedContactKeys: [],
    type: "STRATEGIC",
    campaignChanging: true,
    strategicValue: "HIGH",
  },
  {
    seedKey: "op-jdi",
    title: "JDI FOLLOW-UP",
    summary: "Restricted contact. Mag niet op de radar.",
    category: "PERSON",
    sourceType: "MANUAL",
    relatedStats: ["network"],
    relatedContactKeys: ["c-jdi"],
    type: "STRATEGIC",
    campaignChanging: false,
  },
];
