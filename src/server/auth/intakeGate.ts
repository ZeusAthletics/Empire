import type { SessionPlayer } from "@/server/domain/player/types";

export function playerNeedsIntake(player: SessionPlayer | null | undefined): boolean {
  if (!player || player.role === "ADMIN") return false;
  const at = player.intakeCompletedAt;
  if (!at || at === "null" || at === "undefined") return true;
  const parsed = Date.parse(at);
  return !Number.isFinite(parsed);
}

export function afterLoginPath(player: SessionPlayer | null | undefined): string {
  if (player?.role === "ADMIN") return "/admin";
  if (!player || playerNeedsIntake(player)) return "/intake";
  return "/home";
}
