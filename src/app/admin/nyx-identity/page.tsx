import { adminScoped } from "@/admin/gate";
import { NyxIdentityView } from "@/admin/views/NyxIdentity";
import { listIdentityRefs } from "@/server/domain/nyx/identity/repository";

export default async function AdminNyxIdentityPage() {
  await adminScoped("/admin/nyx-identity");
  const refs = await listIdentityRefs();
  return <NyxIdentityView refs={refs} />;
}
