import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionPlayer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const player = await getSessionPlayer();
  if (player) redirect("/home");

  return (
    <div className="app">
      <LoginForm />
    </div>
  );
}
