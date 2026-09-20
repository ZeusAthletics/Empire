import { adminScoped } from "@/admin/gate";
import { NyxCuratedGalleryView } from "@/admin/views/NyxCuratedGallery";
import { listCuratedForAdmin } from "@/server/domain/nyx/curated/repository";

export default async function AdminNyxCuratedGalleryPage() {
  const scoped = await adminScoped("/admin/nyx-gallery");
  const items = await listCuratedForAdmin(scoped.id);
  return <NyxCuratedGalleryView items={items} scopedName={scoped.displayName} />;
}
