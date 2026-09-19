export async function decideProposal(id: string, action: "approve" | "reject") {
  const response = await fetch(`/api/admin/proposals/${id}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return response.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function runAdminEvals() {
  const response = await fetch("/api/admin/evals");
  return response.json() as Promise<{ ok: boolean; passed: number; total: number }>;
}
