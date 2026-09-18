import { redirect } from "next/navigation";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const campaign = await findPublicCampaignByPlayerId(player.id);
  return <ProfileScreen player={toPublicPlayer(player)} campaign={campaign} />;
}
