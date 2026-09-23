import { MapIconsAdminView } from "@/admin/views/MapIconsAdmin";
import { listMapIconSets } from "@/server/domain/map/iconSets";

export default async function AdminMapIconsPage() {
  const sets = await listMapIconSets(false);
  return <MapIconsAdminView sets={sets} />;
}
