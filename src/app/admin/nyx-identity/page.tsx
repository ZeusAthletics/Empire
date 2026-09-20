import { adminScoped } from "@/admin/gate";
import { NyxIdentityView } from "@/admin/views/NyxIdentity";
import { listNyxGallery } from "@/server/domain/nyx/galleryRepository";
import { listIdentityRefs } from "@/server/domain/nyx/identity/repository";

export default async function AdminNyxIdentityPage() {
  const scoped = await adminScoped("/admin/nyx-identity");
  const [refs, gallery] = await Promise.all([listIdentityRefs(), listNyxGallery(scoped.id)]);
  return <NyxIdentityView refs={refs} gallery={gallery} />;
}
