import { redirect } from "next/navigation";
import { IntakeScreen } from "@/features/intake/IntakeScreen";
import { getSessionPlayer } from "@/server/auth/session";
import { playerNeedsIntake } from "@/server/auth/intakeGate";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  if (player.role === "ADMIN") redirect("/admin");
  if (!playerNeedsIntake(player)) redirect("/home");
  return <IntakeScreen />;
}
