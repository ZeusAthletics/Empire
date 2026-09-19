import { redirect } from "next/navigation";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { listVisibleContacts } from "@/server/domain/contact/repository";
import { listMonthlyWraps } from "@/server/domain/journal/repository";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const [campaign, wraps, contacts] = await Promise.all([
    findPublicCampaignByPlayerId(player.id),
    listMonthlyWraps(player.id),
    listVisibleContacts(player.id),
  ]);
  return <ProfileScreen player={toPublicPlayer(player)} campaign={campaign} wraps={wraps} contacts={contacts} />;
}
