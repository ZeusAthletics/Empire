import { after } from "next/server";
import { createMissionCompletionJournalEntry } from "@/server/domain/journal/missionJournal";

export function scheduleMissionCompletionJournal(playerId: string, missionId: string): void {
  after(() =>
    createMissionCompletionJournalEntry(playerId, missionId).catch(() => undefined),
  );
}
