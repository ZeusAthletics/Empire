import { PersonaView } from "@/admin/views/Persona";
import { adminScoped } from "@/admin/gate";
import { getActivePersona, fallbackCompiledPrompt } from "@/server/domain/persona/repository";

export default async function AdminPersonaPage() {
  await adminScoped("/admin/persona");
  const active = await getActivePersona().catch(() => null);
  return (
    <PersonaView
      initialPrompt={active?.compiledPrompt || fallbackCompiledPrompt()}
      initialVersion={active?.version ?? 1}
    />
  );
}
