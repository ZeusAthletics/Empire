import { PersonaView } from "@/admin/views/Persona";
import { adminScoped } from "@/admin/gate";

export default async function AdminPersonaPage() {
  await adminScoped("/admin/persona");
  return <PersonaView />;
}
