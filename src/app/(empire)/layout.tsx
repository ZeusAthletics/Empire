import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionPlayer } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function EmpireLayout({ children }: { children: ReactNode }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  return <AppShell>{children}</AppShell>;
}
