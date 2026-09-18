import { redirect } from "next/navigation";
import { MapScreen } from "@/screens/MapScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { getMapState } from "@/server/domain/map/repository";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string; contact?: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const [{ mission, contact }, state] = await Promise.all([searchParams, getMapState(player.id)]);
  return <MapScreen state={state} focusMissionId={mission} focusContactId={contact} />;
}
