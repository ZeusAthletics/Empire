import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionPlayer } from "@/server/auth/session";
import { playerNeedsIntake } from "@/server/auth/intakeGate";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const player = await getSessionPlayer();
  if (player?.role === "ADMIN") redirect("/admin");
  if (playerNeedsIntake(player)) redirect("/intake");
  if (player) redirect("/home");

  return (
    <div className="app">
      <LoginForm />
    </div>
  );
}
