import { redirect } from "next/navigation";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  return <ProfileScreen player={toPublicPlayer(player)} />;
}
