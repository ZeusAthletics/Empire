import { redirect } from "next/navigation";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";

export async function adminScoped(path: string) {
  const operator = await requireAdmin();
  if (!operator) redirect("/");
  return resolveAdminScope(operator, path);
}
