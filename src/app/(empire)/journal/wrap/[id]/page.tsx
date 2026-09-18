import { notFound, redirect } from "next/navigation";
import { MonthlyWrap } from "@/screens/MonthlyWrap";
import { getSessionPlayer } from "@/server/auth/session";
import { getJournalState } from "@/server/domain/journal/repository";

export const dynamic = "force-dynamic";

export default async function WrapPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { id } = await params;
  const state = await getJournalState(player.id);
  const wrap = state.wraps.find((item) => item.id === id);
  if (!wrap) notFound();
  return <MonthlyWrap wrap={wrap} entries={state.entries} />;
}
