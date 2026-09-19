import { PatternsView } from "@/admin/views/Patterns";
import { loadPatternsPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminPatternsPage() {
  const player = await adminScoped("/admin/patterns");
  const patterns = await loadPatternsPage(player);
  return <PatternsView patterns={patterns} />;
}
