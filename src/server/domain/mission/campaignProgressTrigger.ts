import { after } from "next/server";
import { progressCampaign } from "@/server/domain/campaign/director/CampaignDirector";

export function scheduleCampaignProgressAfterMissionComplete(playerId: string, missionId: string): void {
  after(() =>
    progressCampaign(playerId, { missionId, reason: "mission_complete" }).catch(() => undefined),
  );
}
