import { RadarView } from "@/admin/views/Radar";
import { loadRadarPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminRadarPage() {
  const player = await adminScoped("/admin/radar");
  const items = await loadRadarPage(player);
  return <RadarView items={items} />;
}
