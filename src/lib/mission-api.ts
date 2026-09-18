export async function postMissionAction(
  id: string,
  action: "continue" | "activate",
  body?: { objectiveId?: string },
) {
  const response = await fetch(`/api/missions/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await response.json()) as { ok: boolean; error?: string; message?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Actie mislukt.");
  }
  return data;
}
