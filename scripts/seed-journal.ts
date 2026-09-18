import type { JournalMediaKind } from "../src/server/domain/journal/types";

function atToday(hours: number, minutes: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).toISOString();
}

function daysAgo(days: number, hours: number, minutes: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hours, minutes).toISOString();
}

export type SeedJournalEntry = {
  seedKey: string;
  occurredAt: () => string;
  icon: string;
  title: string;
  body: string;
  tags: string[];
  contactKeys: string[];
  missionKey?: string;
  locationName?: string;
  media: { kind: JournalMediaKind; label: string }[];
  extraMedia: number;
};

export const SEED_JOURNAL: SeedJournalEntry[] = [
  {
    seedKey: "j1",
    occurredAt: () => atToday(6, 15),
    icon: "dumb",
    title: "Workout — Upper Body",
    tags: ["HEALTH", "EXECUTION"],
    body: "Push day in de garage gym. Voelde sterk.",
    contactKeys: [],
    media: [
      { kind: "gym", label: "Gym" },
      { kind: "gym", label: "Set" },
      { kind: "gym", label: "Rack" },
    ],
    extraMedia: 2,
  },
  {
    seedKey: "j2",
    occurredAt: () => atToday(8, 30),
    icon: "laptop",
    title: "Deep Work — Strategie",
    tags: ["BUSINESS", "STRATEGY"],
    body: "Q4 uitgewerkt. Focus op één nieuwe markt in plaats van drie.",
    contactKeys: [],
    missionKey: "m-q4",
    media: [
      { kind: "note", label: "Discipline" },
      { kind: "note", label: "Schema" },
      { kind: "city", label: "Skyline" },
    ],
    extraMedia: 1,
  },
  {
    seedKey: "j3",
    occurredAt: () => atToday(12, 30),
    icon: "users",
    title: "Lunch met Pieter",
    tags: ["NETWORK", "OPPORTUNITY"],
    body: "Goede gesprekken over samenwerking en capaciteit. Volgende week voorstel sturen.",
    contactKeys: ["c-pieter"],
    missionKey: "m-lunch",
    locationName: "Heist-op-den-Berg",
    media: [
      { kind: "meet", label: "Lunch" },
      { kind: "note", label: "Notities" },
    ],
    extraMedia: 2,
  },
  {
    seedKey: "j4",
    occurredAt: () => atToday(15, 45),
    icon: "file",
    title: "Content — LinkedIn post",
    tags: ["AUTHORITY", "BRAND"],
    body: "Artikel geschreven: “Discipline als concurrentievoordeel.”",
    contactKeys: [],
    missionKey: "m-article",
    media: [
      { kind: "note", label: "Draft" },
      { kind: "meet", label: "Portret" },
      { kind: "city", label: "Kempen" },
    ],
    extraMedia: 1,
  },
  {
    seedKey: "j5",
    occurredAt: () => atToday(18, 30),
    icon: "tool",
    title: "Renovatie studio",
    tags: ["PERSONAL", "EXECUTION"],
    body: "Vloer bijna af. Morgen meubels laten leveren.",
    contactKeys: [],
    media: [
      { kind: "room", label: "Vloer" },
      { kind: "room", label: "Studio" },
    ],
    extraMedia: 3,
  },
  {
    seedKey: "j6",
    occurredAt: () => atToday(21, 0),
    icon: "bookopen",
    title: "Reading — The Prince",
    tags: ["GROWTH"],
    body: "Hoofdstuk 6–7. Macht, perceptie en timing. Veel parallellen met positionering.",
    contactKeys: [],
    media: [
      { kind: "book", label: "Boek" },
      { kind: "book", label: "Passage" },
    ],
    extraMedia: 1,
  },
  {
    seedKey: "j7",
    occurredAt: () => daysAgo(4, 19, 30),
    icon: "users",
    title: "UNIZO netwerkavond",
    tags: ["NETWORK", "EVENT"],
    body: "Vijf lokale ondernemers gesproken. Twee willen een scan.",
    contactKeys: [],
    missionKey: "m-unizo",
    locationName: "Heist-op-den-Berg",
    media: [{ kind: "meet", label: "Avond" }],
    extraMedia: 0,
  },
  {
    seedKey: "j8",
    occurredAt: () => daysAgo(9, 11, 0),
    icon: "zap",
    title: "Tarief verhoogd naar €180/u",
    tags: ["BUSINESS", "CAPITAL"],
    body: "Eerste nieuwe klant akkoord zonder discussie. Had dit zes maanden eerder moeten doen.",
    contactKeys: [],
    media: [],
    extraMedia: 0,
  },
  {
    seedKey: "j9",
    occurredAt: () => daysAgo(13, 16, 20),
    icon: "build",
    title: "Site live — Kempen Vice",
    tags: ["BRAND", "EXECUTION"],
    body: "Nieuw thema staat online. Tracking loopt. Nu content, geen tools meer bouwen.",
    contactKeys: [],
    media: [{ kind: "city", label: "Site" }],
    extraMedia: 0,
  },
];

export const SEED_WRAP_AUGUST = {
  monthId: "2026-08",
  label: "AUGUSTUS 2026",
  year: 2026,
  events: 3,
  newContacts: 7,
  missionsCompleted: 6,
  empireDelta: 5200,
  deltas: { income: 12, execution: 8, network: 4 },
  biggestWin: "Instaptarief losgelaten bij twee offertes.",
  biggestMistake: "Drie weken aan de site gewerkt in plaats van te bellen.",
  bestRelationship: "Nico — bracht een tweede klant aan zonder dat u ernaar vroeg.",
  keyDecision: "Stoppen met gratis adviesgesprekken van meer dan 30 minuten.",
  bestMission: "Eerste betalende klant",
  timeSink: "Thema-tweaks op de website.",
  whatChanged: "De praktijk is voor het eerst winstgevend zonder JDI-uren.",
  nyx: "Augustus was de maand waarin u leerde vragen wat het waard is.",
};
