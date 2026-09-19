import type { AdminKpi } from "@/admin/data";
import { money } from "@/admin/format";
import Link from "next/link";

function Spark({ series, color = "var(--gold)" }: { series: number[]; color?: string }) {
  if (!series.length) return null;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const pts = series
    .map((value, index) => {
      const x = series.length === 1 ? 0 : index * (120 / (series.length - 1));
      const y = 34 - ((value - min) / (max - min || 1)) * 30;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 120 36" preserveAspectRatio="none" style={{ width: "100%", height: 36, marginTop: 8 }} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} />
    </svg>
  );
}

export function OverviewView({
  kpi,
  runsSeries,
  costSeries,
}: {
  kpi: AdminKpi;
  runsSeries: number[];
  costSeries: number[];
}) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Overview</h1>
        <span className="muted mono">laatste 7 dagen</span>
      </div>
      <div className="grid g4">
        <div className="card kpi">
          <span className="eyebrow">AI-runs</span>
          <div className="v" style={{ margin: "6px 0 2px" }}>{kpi.runs7d}</div>
          <div className="d muted">NyxRun-rijen</div>
        </div>
        <div className="card kpi">
          <span className="eyebrow">Kosten</span>
          <div className="v" style={{ margin: "6px 0 2px" }}>{money(kpi.costCents7d)}</div>
          <div className="d muted">geschat</div>
        </div>
        <div className="card kpi">
          <span className="eyebrow">p95-latentie</span>
          <div className="v" style={{ margin: "6px 0 2px" }}>{(kpi.p95 / 1000).toFixed(1)} s</div>
          <div className={`d ${kpi.p95 < 2500 ? "up" : "down"}`}>doel &lt; 2,5 s</div>
        </div>
        <div className="card kpi">
          <span className="eyebrow">Foutratio</span>
          <div className="v" style={{ margin: "6px 0 2px" }}>{kpi.errorRate}%</div>
          <div className="d muted">status ≠ OK</div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card">
          <span className="eyebrow">Runs per dag</span>
          <Spark series={runsSeries} />
        </div>
        <div className="card">
          <span className="eyebrow">Kosten per dag (cent)</span>
          <Spark series={costSeries} color="var(--amber)" />
        </div>
      </div>

      <div className="grid g3" style={{ marginTop: 12 }}>
        <Link href="/admin/proposals" className="card gold" style={{ textAlign: "left" }}>
          <span className="eyebrow">Wacht op beslissing</span>
          <div className="kpi">
            <div className="v" style={{ margin: "6px 0 8px", color: "var(--gold-soft)" }}>{kpi.pending}</div>
          </div>
          <div className="mono muted">Goedkeuren maakt het zichtbaar op de telefoon</div>
        </Link>
        <div className="card">
          <span className="eyebrow">Interruptbudget</span>
          <div className="kpi">
            <div className="v" style={{ margin: "6px 0 8px" }}>{kpi.interruptsWeek} / {kpi.interruptBudget}</div>
          </div>
          <div className="bar jade">
            <i style={{ width: `${Math.min(100, (kpi.interruptsWeek / Math.max(1, kpi.interruptBudget)) * 100)}%` }} />
          </div>
          <div className="mono muted" style={{ marginTop: 6 }}>deze week · max 1 per dag</div>
        </div>
        <div className="card">
          <span className="eyebrow">Gezondheid van de extractie</span>
          <div style={{ display: "grid", gap: 9, marginTop: 9 }}>
            <div>
              <div className="mono muted" style={{ marginBottom: 4 }}>
                Turns met memory · {Math.round(kpi.memoryRate * 100)}% (doel &lt; 40%)
              </div>
              <div className="bar jade"><i style={{ width: `${Math.min(100, kpi.memoryRate * 100)}%` }} /></div>
            </div>
            <div>
              <div className="mono muted" style={{ marginBottom: 4 }}>
                Afgewezen proposals · {Math.round(kpi.rejectRate * 100)}% (doel &lt; 30%)
              </div>
              <div className="bar jade"><i style={{ width: `${Math.min(100, kpi.rejectRate * 100)}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
