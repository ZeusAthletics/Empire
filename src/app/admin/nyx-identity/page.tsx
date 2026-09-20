import { adminScoped } from "@/admin/gate";
import { NyxIdentityView } from "@/admin/views/NyxIdentity";
import { listNyxGallery } from "@/server/domain/nyx/galleryRepository";
import { getCanonicalFacePrompt, getNyxImageEditModel, listIdentityRefs } from "@/server/domain/nyx/identity/repository";

export default async function AdminNyxIdentityPage() {
  const scoped = await adminScoped("/admin/nyx-identity");
  const [refs, gallery, facePrompt, imageEditModel] = await Promise.all([
    listIdentityRefs(),
    listNyxGallery(scoped.id),
    getCanonicalFacePrompt(),
    getNyxImageEditModel(),
  ]);
  return (
    <NyxIdentityView refs={refs} gallery={gallery} facePrompt={facePrompt} imageEditModel={imageEditModel} />
  );
}
