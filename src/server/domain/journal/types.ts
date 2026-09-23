import type { RecordSource } from "@/server/domain/mission/types";

export type JournalFilter = "today" | "week" | "month" | "all";

export type JournalMediaKind = "gym" | "note" | "meet" | "city" | "room" | "book" | "mission";

export type JournalMedia = {
  kind: JournalMediaKind;
  label: string;
  src?: string;
  approved?: boolean;
  mediaId?: string;
};

export type JournalContact = {
  id: string;
  name: string;
};

export type JournalEntry = {
  id: string;
  at: string;
  title: string;
  body: string;
  icon: string;
  tags: string[];
  contactIds: string[];
  contacts: JournalContact[];
  missionId: string | null;
  missionTitle: string | null;
  locationName: string | null;
  media: JournalMedia[];
  extraMedia: number;
  source: RecordSource;
  lockedByAdmin: boolean;
};

export type MonthlyWrap = {
  id: string;
  label: string;
  year: number;
  events: number;
  newContacts: number;
  missionsCompleted: number;
  empireDelta: number;
  deltas: Record<string, number>;
  biggestWin: string;
  biggestMistake: string;
  bestRelationship: string;
  keyDecision: string;
  bestMission: string;
  timeSink: string;
  whatChanged: string;
  nyx: string;
  generatedAt: string | null;
  entryIds: string[];
  media: JournalMedia[];
};

export type JournalState = {
  entries: JournalEntry[];
  wraps: MonthlyWrap[];
  monthEntryCount: number;
};

export type CreateJournalInput = {
  body: string;
  icon?: string;
  tags?: string[];
  locationName?: string | null;
  missionId?: string | null;
  media?: JournalMedia[];
};
