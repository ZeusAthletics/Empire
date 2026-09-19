import { tagTone } from "@/admin/format";
import type { StrategicPattern } from "@/server/domain/pattern/types";

export function PatternsView({ patterns }: { patterns: StrategicPattern[] }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Patterns</h1>
        <span className="muted mono">{patterns.length}</span>
      </div>
      <div className="table">
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: "1.6fr .7fr .6fr .8fr 1fr" }}>
            <span className="th">Patroon</span>
            <span className="th">Status</span>
            <span className="th">Impact</span>
            <span className="th">Stats</span>
            <span className="th">Bewijs</span>
          </div>
        </div>
        {patterns.length ? (
          patterns.map((pattern) => (
            <div key={pattern.id} className="tr" style={{ gridTemplateColumns: "1.6fr .7fr .6fr .8fr 1fr" }}>
              <div>
                <div className="td-main">{pattern.title}</div>
                <div className="td-sub">{pattern.description}</div>
              </div>
              <span className={`tag ${tagTone(pattern.status)}`}>{pattern.status}</span>
              <span className={`tag ${tagTone(pattern.strategicImpact)}`}>{pattern.strategicImpact}</span>
              <span className="mono muted">{pattern.relatedStats.join(" · ")}</span>
              <span className="mono muted">{pattern.evidenceRefs.length} bronnen</span>
            </div>
          ))
        ) : (
          <div className="empty">Geen patronen.</div>
        )}
      </div>
    </>
  );
}
