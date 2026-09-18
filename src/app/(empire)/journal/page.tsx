import { redirect } from "next/navigation";
import { JournalScreen } from "@/screens/JournalScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { getJournalState } from "@/server/domain/journal/repository";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const initial = await getJournalState(player.id);
  return <JournalScreen initial={initial} />;
}
