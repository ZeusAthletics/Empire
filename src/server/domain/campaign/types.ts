import type { StatKey } from "@/server/domain/player/types";

export type RecordSource = "AI" | "ADMIN" | "USER";
export type CampaignStatus = "ACTIVE" | "ARCHIVED";
export type ChapterStatus = "LOCKED" | "ACTIVE" | "COMPLETED";

export type CampaignRow = {
  id: string;
  player_id: string;
  title: string;
  north_star: string;
  current_chapter_id: string | null;
  bottleneck_stat: StatKey;
  bottleneck_set_at: string;
  bottleneck_reason: string;
  status: CampaignStatus;
  source: RecordSource;
  locked_by_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ChapterRow = {
  id: string;
  campaign_id: string;
  player_id: string;
  index: number;
  roman: string;
  name: string;
  tagline: string;
  economic_from: number;
  economic_to: number;
  economic_current: number;
  exit_criteria: string[];
  status: ChapterStatus;
  opened_at: string | null;
  closed_at: string | null;
  source: RecordSource;
  locked_by_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PublicChapter = {
  id: string;
  roman: string;
  name: string;
  tagline: string;
  economicFrom: number;
  economicTo: number;
  economicCurrent: number;
  status: ChapterStatus;
};

export type PublicCampaign = {
  id: string;
  title: string;
  northStar: string;
  bottleneckStat: StatKey;
  bottleneckReason: string;
  chapter: PublicChapter | null;
};

export function mapChapter(row: ChapterRow): PublicChapter {
  return {
    id: row.id,
    roman: row.roman,
    name: row.name,
    tagline: row.tagline,
    economicFrom: row.economic_from,
    economicTo: row.economic_to,
    economicCurrent: row.economic_current,
    status: row.status,
  };
}

export function mapCampaign(row: CampaignRow, chapter: ChapterRow | null): PublicCampaign {
  return {
    id: row.id,
    title: row.title,
    northStar: row.north_star,
    bottleneckStat: row.bottleneck_stat,
    bottleneckReason: row.bottleneck_reason,
    chapter: chapter ? mapChapter(chapter) : null,
  };
}
