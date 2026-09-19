import type { AdminRun } from "@/admin/data";
import { relTime, tagTone } from "@/admin/format";

export function RunsView({ runs }: { runs: AdminRun[] }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>AI runs</h1>
        <span className="muted mono">model, promptversie, tokens — nooit in de spelers-UI</span>
      </div>
      <div className="table">
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: ".8fr .8fr .7fr .8fr .5fr .5fr .5fr .5fr" }}>
            <span className="th">Taak</span>
            <span className="th">Model</span>
            <span className="th">Tier</span>
            <span className="th">Prompt</span>
            <span className="th">In/uit</span>
            <span className="th">ms</span>
            <span className="th">Status</span>
            <span className="th">Wanneer</span>
          </div>
        </div>
        {runs.length ? (
          runs.map((run) => (
            <div key={run.id} className="tr" style={{ gridTemplateColumns: ".8fr .8fr .7fr .8fr .5fr .5fr .5fr .5fr" }}>
              <div>
                <div className="td-main">{run.taskType || run.service}</div>
                <div className="td-sub">{run.error ?? run.service}</div>
              </div>
              <span className="mono muted">{run.model || "—"}</span>
              <span className="tag">{run.modelTier || "—"}</span>
              <span className="mono muted">{run.promptVersion}</span>
              <span className="mono muted">{run.inputTokens}/{run.outputTokens}</span>
              <span className="mono muted">{run.latencyMs}</span>
              <span className={`tag ${tagTone(run.status)}`}>{run.status}</span>
              <span className="mono muted">{relTime(run.createdAt)}</span>
            </div>
          ))
        ) : (
          <div className="empty">Nog geen runs. Metadata blijft intern.</div>
        )}
      </div>
    </>
  );
}
