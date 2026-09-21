export function isMissingDirectorSchema(message: string): boolean {
  return /chapter_exit_criteria|mission_dependencies|campaign_events|planned_payload|progression_lock|schema cache|PGRST204|PGRST205|column.*does not exist/i.test(
    message,
  );
}

export function formatReplanError(error: unknown): { status: number; error: string } {
  const raw = error instanceof Error ? error.message : "Replan mislukt.";
  if (isMissingDirectorSchema(raw)) {
    return {
      status: 503,
      error:
        "Campaign Director-database ontbreekt. Draai migratie 20260921140000_campaign_director.sql op Supabase (of npm run db:apply:campaign-director).",
    };
  }
  if (/Strategische taak|Sol-call|Modelcall|OPENAI_API_KEY/i.test(raw)) {
    return { status: 502, error: raw };
  }
  return { status: 500, error: raw || "Replan mislukt." };
}

export function formatReplanReason(reason: string): string {
  switch (reason) {
    case "no_chapter":
      return "Geen actief hoofdstuk gevonden.";
    case "planner_failed":
      return "Hoofdstuk-planning mislukt (ongeldige AI-output of modelfout). Probeer opnieuw.";
    case "mission_planner_failed":
      return "Main-mission planning mislukt (ongeldige AI-output of modelfout). Probeer opnieuw.";
    default:
      return reason;
  }
}
