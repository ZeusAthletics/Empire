import { notFound, redirect } from "next/navigation";
import { MissionDetail } from "@/screens/MissionDetail";
import { getSessionPlayer } from "@/server/auth/session";
import { getMission } from "@/server/domain/mission/repository";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { id } = await params;
  try {
    const mission = await getMission(player.id, id);
    return <MissionDetail mission={mission} />;
  } catch {
    notFound();
  }
}
