export class EmpireValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmpireValueError";
  }
}

export function parseEmpireDelta(raw: unknown, sign: "plus" | "min" = "plus"): number {
  const digits =
    typeof raw === "number"
      ? String(Math.round(raw))
      : String(raw ?? "").replace(/[^\d-]/g, "").trim();
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new EmpireValueError("Vul een bedrag in dat niet nul is.");
  }
  const abs = Math.round(Math.abs(amount));
  if (abs > 10_000_000) {
    throw new EmpireValueError("Dat bedrag is te groot.");
  }
  return sign === "min" ? -abs : abs;
}

export function applyEmpireDelta(current: number, delta: number): number {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new EmpireValueError("Vul een bedrag in dat niet nul is.");
  }
  return current + delta;
}
