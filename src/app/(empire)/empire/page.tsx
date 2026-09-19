import { redirect } from "next/navigation";
import { EmpireValueScreen } from "@/screens/EmpireValueScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { getEmpireValueState } from "@/server/domain/empire/repository";

export const dynamic = "force-dynamic";

export default async function EmpireValuePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const initial = await getEmpireValueState(player.id);
  return <EmpireValueScreen initial={initial} />;
}
