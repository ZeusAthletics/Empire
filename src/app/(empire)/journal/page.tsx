import { redirect } from "next/navigation";
import { JournalScreen } from "@/screens/JournalScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { getJournalState } from "@/server/domain/journal/repository";
import { listMissions } from "@/server/domain/mission/repository";
import { listLiveOpportunities } from "@/server/domain/opportunity/repository";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const [initial, missions, radar] = await Promise.all([
    getJournalState(player.id),
    listMissions(player.id).catch(() => []),
    listLiveOpportunities(player.id).catch(() => []),
  ]);
  const upcoming = missions
    .filter((mission) => mission.status === "ACTIVE" || mission.status === "LOCKED" || mission.status === "BLOCKED")
    .slice(0, 4)
    .map((mission) => ({
      id: mission.id,
      when: mission.whenLabel ?? mission.estimateLabel ?? "Gepland",
      title: mission.title,
      detail: mission.locationName ?? "",
    }));
  return (
    <JournalScreen initial={initial} upcoming={upcoming} opportunityCount={radar.length} />
  );
}
