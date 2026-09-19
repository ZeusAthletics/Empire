import { AssetsView } from "@/admin/views/Assets";
import { loadAssetsPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminAssetsPage() {
  const player = await adminScoped("/admin/assets");
  const assets = await loadAssetsPage(player);
  return <AssetsView assets={assets} />;
}
