import { CampaignView } from "@/admin/views/Campaign";
import { loadCampaignPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminCampaignPage() {
  const player = await adminScoped("/admin/campaign");
  const data = await loadCampaignPage(player);
  return <CampaignView campaign={data.campaign} missions={data.missions} counts={data.counts} stats={data.stats} />;
}
