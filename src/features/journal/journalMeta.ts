import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Dumbbell,
  FileText,
  Gem,
  Laptop,
  Pencil,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { JournalEntry, JournalFilter } from "@/server/domain/journal/types";
import { monthIdFrom } from "@/server/domain/journal/dates";

export const JOURNAL_FILTERS: { key: JournalFilter; label: string }[] = [
  { key: "today", label: "Vandaag" },
  { key: "week", label: "Deze week" },
  { key: "month", label: "Deze maand" },
  { key: "all", label: "All time" },
];

export const JOURNAL_ICONS: Record<string, LucideIcon> = {
  dumb: Dumbbell,
  laptop: Laptop,
  users: Users,
  file: FileText,
  tool: Wrench,
  bookopen: BookOpen,
  zap: Zap,
  build: Building2,
  edit: Pencil,
  gem: Gem,
  clock: Clock,
  cal: Calendar,
};

const PLACEHOLDER_MEDIA = ["meet", "city", "room", "note", "gym"] as const;

export function nextPlaceholderMedia(count: number) {
  const kind = PLACEHOLDER_MEDIA[count % PLACEHOLDER_MEDIA.length];
  return { kind, label: "Beeld" as const };
}

export function filterEntries(entries: JournalEntry[], filter: JournalFilter, viewed: Date): JournalEntry[] {
  const now = Date.now();
  return entries
    .filter((entry) => {
      const at = new Date(entry.at);
      if (filter === "today") {
        return (
          at.getDate() === viewed.getDate() &&
          at.getMonth() === viewed.getMonth() &&
          at.getFullYear() === viewed.getFullYear()
        );
      }
      if (filter === "week") return now - at.getTime() < 7 * 864e5;
      if (filter === "month") return monthIdFrom(at) === monthIdFrom(now);
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
