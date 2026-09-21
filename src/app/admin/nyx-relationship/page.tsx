import { loadNyxRelationshipPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";
import { NyxRelationshipView } from "@/admin/views/NyxRelationship";

export default async function AdminNyxRelationshipPage() {
  const player = await adminScoped("/admin/nyx-relationship");
  const { latest, history, budget, usage, loadError } = await loadNyxRelationshipPage(player);
  return (
    <NyxRelationshipView
      playerName={player.displayName}
      latest={latest}
      history={history}
      budget={budget}
      usage={usage}
      loadError={loadError}
    />
  );
}
