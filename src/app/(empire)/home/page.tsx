import { redirect } from "next/navigation";
import { HomeScreen } from "@/screens/HomeScreen";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  return <HomeScreen player={toPublicPlayer(player)} />;
}
