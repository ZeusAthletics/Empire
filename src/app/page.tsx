import { HelloScreen } from "@/components/HelloScreen";
import { LoginForm } from "@/components/LoginForm";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const player = await getSessionPlayer();
  if (!player) {
    return <LoginForm />;
  }
  return <HelloScreen player={toPublicPlayer(player)} />;
}
