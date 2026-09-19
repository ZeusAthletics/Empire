import { RunsView } from "@/admin/views/Runs";
import { listAdminRuns } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminRunsPage() {
  const player = await adminScoped("/admin/runs");
  const runs = await listAdminRuns(player.id);
  return <RunsView runs={runs} />;
}
