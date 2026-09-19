import type { ReactNode } from "react";
import { JetBrains_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/AdminShell";
import { pendingCount } from "@/admin/data";
import { resolveAdminScope } from "@/admin/scope";
import { getSessionPlayer } from "@/server/auth/session";
import "@/admin/admin.css";

const jetbrains = JetBrains_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const operator = await getSessionPlayer();
  if (!operator) redirect("/");
  if (operator.role !== "ADMIN") redirect("/home");
  const scoped = await resolveAdminScope(operator, "/admin");
  const pending = await pendingCount(scoped.id);

  return (
    <div className={jetbrains.variable}>
      <AdminShell
        pending={pending}
        operatorName={operator.displayName}
        scopedName={scoped.displayName}
        scopedId={scoped.id}
      >
        {children}
      </AdminShell>
    </div>
  );
}
