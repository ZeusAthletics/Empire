import { tagTone } from "@/admin/format";
import type { Opportunity } from "@/server/domain/opportunity/types";

export function RadarView({ items }: { items: Opportunity[] }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Opportunity radar</h1>
        <span className="muted mono">scorekolommen zichtbaar</span>
      </div>
      <div className="table">
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: "1.4fr .4fr .5fr .5fr .5fr .5fr .5fr .5fr .6fr" }}>
            <span className="th">Item</span>
            <span className="th">Score</span>
            <span className="th">Bottleneck</span>
            <span className="th">Proximity</span>
            <span className="th">Timing</span>
            <span className="th">Relatie</span>
            <span className="th">Interest</span>
            <span className="th">LLM ±</span>
            <span className="th">Status</span>
          </div>
        </div>
        {items.length ? (
          items.map((item) => {
            const b = item.scoreBreakdown;
            return (
              <div key={item.id} className="tr" style={{ gridTemplateColumns: "1.4fr .4fr .5fr .5fr .5fr .5fr .5fr .5fr .6fr" }}>
                <div>
                  <div className="td-main">{item.title}</div>
                  <div className="td-sub">{item.reasonsForRelevance[0] ?? item.summary}</div>
                </div>
                <span className="mono">{item.relevanceScore}</span>
                <span className="mono muted">{b ? b.bottleneckFit.toFixed(2) : "—"}</span>
                <span className="mono muted">{b ? b.proximity.toFixed(2) : "—"}</span>
                <span className="mono muted">{b ? b.timing.toFixed(2) : "—"}</span>
                <span className="mono muted">{b ? b.relationshipFit.toFixed(2) : "—"}</span>
                <span className="mono muted">{b ? b.interestFit.toFixed(2) : "—"}</span>
                <span className="mono muted">{item.scoreAdjustment}</span>
                <span className={`tag ${tagTone(item.status)}`}>{item.status}</span>
              </div>
            );
          })
        ) : (
          <div className="empty">Geen opportunities.</div>
        )}
      </div>
    </>
  );
}
