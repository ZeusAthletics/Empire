import { redirect } from "next/navigation";
import { RadarScreen } from "@/screens/RadarScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { getRadar } from "@/server/ai/services/OpportunityIntelligenceService";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const radar = await getRadar(player.id);
  return <RadarScreen initial={radar.items} />;
}
