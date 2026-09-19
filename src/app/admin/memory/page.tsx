import { MemoryView } from "@/admin/views/Memory";
import { loadMemoryPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminMemoryPage() {
  const player = await adminScoped("/admin/memory");
  const rows = await loadMemoryPage(player);
  return <MemoryView rows={rows} />;
}
