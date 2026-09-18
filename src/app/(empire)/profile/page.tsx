import { redirect } from "next/navigation";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { listMonthlyWraps } from "@/server/domain/journal/repository";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const [campaign, wraps] = await Promise.all([
    findPublicCampaignByPlayerId(player.id),
    listMonthlyWraps(player.id),
  ]);
  return <ProfileScreen player={toPublicPlayer(player)} campaign={campaign} wraps={wraps} />;
}
