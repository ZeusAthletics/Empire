import { redirect } from "next/navigation";
import { HomeScreen } from "@/screens/HomeScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { listMissions } from "@/server/domain/mission/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const [campaign, missions] = await Promise.all([
    findPublicCampaignByPlayerId(player.id),
    listMissions(player.id),
  ]);
  return <HomeScreen player={toPublicPlayer(player)} campaign={campaign} missions={missions} />;
}
