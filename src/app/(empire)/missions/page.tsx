import { redirect } from "next/navigation";
import { MissionsScreen } from "@/screens/MissionsScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { listMissions } from "@/server/domain/mission/repository";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const missions = await listMissions(player.id);
  return <MissionsScreen missions={missions} />;
}
