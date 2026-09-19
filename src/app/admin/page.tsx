import { OverviewView } from "@/admin/views/Overview";
import { loadOverview } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminOverviewPage() {
  const player = await adminScoped("/admin");
  const data = await loadOverview(player);
  return <OverviewView kpi={data.kpi} runsSeries={data.runsSeries} costSeries={data.costSeries} />;
}
