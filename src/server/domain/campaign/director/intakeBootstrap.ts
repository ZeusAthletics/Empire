import { after } from "next/server";
import { bootstrapChapter } from "@/server/domain/campaign/director/CampaignDirector";

export function scheduleDirectorBootstrap(playerId: string): void {
  after(() => bootstrapChapter(playerId, { mode: "bootstrap" }).catch(() => undefined));
}
