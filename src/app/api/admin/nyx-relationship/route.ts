import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { runNyxRelationshipReview } from "@/server/ai/services/NyxRelationshipService";
import {
  setRelationshipDirection,
  type RelationshipDirectionMode,
} from "@/server/domain/nyx/relationship/direction";
import { setMediaBudget } from "@/server/domain/nyx/relationship/mediaBudget";
import { latestRelationshipSnapshot } from "@/server/domain/nyx/relationship/repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-relationship");

  try {
    const snapshot = await runNyxRelationshipReview(scoped.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relatie-update mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-relationship");

  let body: {
    maxPhotosPerDay?: number;
    maxVideosPerDay?: number;
    directionMode?: RelationshipDirectionMode;
    scenarioId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  try {
    if (body.directionMode !== undefined) {
      const mode = body.directionMode === "guided" ? "guided" : "natural";
      if (mode === "natural") {
        const direction = await setRelationshipDirection(scoped.id, { mode: "natural" });
        return NextResponse.json({ ok: true, direction });
      }
      const latest = await latestRelationshipSnapshot(scoped.id);
      const scenarioId = body.scenarioId?.trim() ?? "";
      const match = latest?.progressScenarios.find((item) => item.id === scenarioId);
      if (!match) {
        return NextResponse.json(
          { ok: false, error: "Onbekend scenario — vraag eerst een nieuwe relatie-update." },
          { status: 400 },
        );
      }
      const direction = await setRelationshipDirection(scoped.id, {
        mode: "guided",
        scenarioId: match.id,
        scenarioTitle: match.title,
        scenarioSummary: match.summary,
        sourceSnapshotId: latest?.id ?? null,
      });
      return NextResponse.json({ ok: true, direction });
    }

    const budget = await setMediaBudget(scoped.id, {
      maxPhotosPerDay: body.maxPhotosPerDay,
      maxVideosPerDay: body.maxVideosPerDay,
    });
    return NextResponse.json({ ok: true, budget });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
