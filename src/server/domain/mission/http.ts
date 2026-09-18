import { NextResponse } from "next/server";
import { RestrictedContactError } from "@/server/validation/missionRuleEngine";
import { MissionClosedError, MissionLockedError } from "@/server/validation/rewardEngine";

export function jsonMissionError(error: unknown) {
  if (error instanceof MissionLockedError || error instanceof RestrictedContactError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }
  if (error instanceof MissionClosedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "Er ging iets mis.";
  const status = message === "Missie niet gevonden." ? 404 : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}
