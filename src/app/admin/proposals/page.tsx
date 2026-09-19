import { ProposalsView } from "@/admin/views/Proposals";
import { loadProposalsPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminProposalsPage() {
  const player = await adminScoped("/admin/proposals");
  const proposals = await loadProposalsPage(player);
  return <ProposalsView proposals={proposals} />;
}
