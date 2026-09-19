import { PromptsView } from "@/admin/views/Prompts";
import { loadPromptsPage } from "@/admin/data";
import { adminScoped } from "@/admin/gate";

export default async function AdminPromptsPage() {
  await adminScoped("/admin/prompts");
  const data = await loadPromptsPage();
  return <PromptsView version={data.version} compiled={data.compiled} />;
}
