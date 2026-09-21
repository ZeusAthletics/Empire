import { MemoryView } from "@/admin/views/Memory";
import { loadMemoryPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminMemoryPage() {
  const player = await adminScoped("/admin/memory");
  const { rows, memoryProposals, loadError } = await loadMemoryPage(player);
  return (
    <MemoryView
      rows={rows}
      memoryProposals={memoryProposals}
      loadError={loadError}
      playerName={player.displayName}
    />
  );
}
