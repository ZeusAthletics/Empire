import { redirect } from "next/navigation";
import { HomeScreen } from "@/screens/HomeScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const campaign = await findPublicCampaignByPlayerId(player.id);
  return <HomeScreen player={toPublicPlayer(player)} campaign={campaign} />;
}
