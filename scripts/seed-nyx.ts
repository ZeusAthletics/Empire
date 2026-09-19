import type { SideQuestProposalPayload } from "../src/server/domain/nyx/proposalTypes";

export const SEED_NYX_PROPOSALS: {
  seedKey: string;
  rationale: string;
  payload: SideQuestProposalPayload;
}[] = [
  {
    seedKey: "ns1",
    rationale: "Drie connectors bereiken samen meer ondernemers dan koud benaderen.",
    payload: {
      title: "BUILD 3 CONNECTOR RELATIONSHIPS",
      duration: "30 dagen",
      difficulty: "Medium",
      xp: 200,
      impact: "Network impact",
      blueprint: {
        kind: "NETWORK",
        track: "MAIN_STORY",
        why: "Drie connectors bereiken samen meer ondernemers dan u in een jaar koud kunt benaderen.",
        mainObjective: "Drie connector-relaties opbouwen",
        objectives: [
          { label: "3 connectors selecteren" },
          { label: "Elk een gesprek van 30 minuten" },
          { label: "Elk één concrete doorverwijzing geven" },
        ],
        locationName: "Kempen",
        lat: 51.11,
        lng: 4.76,
        people: ["c-frans", "c-mike"],
        estimate: "6 u over 30 dagen",
        statReward: { key: "network", amount: 6 },
        evidence: "Drie namen + datum van elk gesprek",
      },
    },
  },
  {
    seedKey: "ns2",
    rationale: "Warm is sneller dan koud.",
    payload: {
      title: "HERACTIVEER 5 SLAPENDE CONTACTEN",
      duration: "14 dagen",
      difficulty: "Low",
      xp: 120,
      impact: "Network impact",
      blueprint: {
        kind: "NETWORK",
        track: "SIDE_QUEST",
        why: "U kent al meer mensen dan u gebruikt. Warm is sneller dan koud.",
        mainObjective: "Vijf contacten opnieuw activeren",
        objectives: [
          { label: "Lijst van 5 namen" },
          { label: "Persoonlijk bericht per naam" },
          { label: "Eén koffie inplannen" },
        ],
        locationName: "Kempen",
        lat: 51.09,
        lng: 4.7,
        people: [],
        estimate: "3 u",
        statReward: { key: "network", amount: 3 },
        evidence: "Vijf verstuurde berichten in Journal",
      },
    },
  },
  {
    seedKey: "ns3",
    rationale: "Het instaptarief is bewijsmateriaal geworden.",
    payload: {
      title: "PRIJSGESPREK MET RITA",
      duration: "7 dagen",
      difficulty: "Medium",
      xp: 150,
      impact: "Capital impact",
      blueprint: {
        kind: "BUSINESS",
        track: "SIDE_QUEST",
        why: "Het instaptarief is bewijsmateriaal geworden in plaats van een startpunt.",
        mainObjective: "Tarief herzien met de eerste klant",
        objectives: [{ label: "Resultaten van 6 maanden op papier" }, { label: "Nieuw tarief voorstellen" }],
        locationName: "Heist-op-den-Berg",
        locationAddress: "Heist-op-den-Berg",
        lat: 51.079,
        lng: 4.735,
        people: ["c-rita"],
        estimate: "1,5 u",
        statReward: { key: "capital", amount: 3 },
        evidence: "Bevestigd nieuw tarief",
      },
    },
  },
];
