import { relTime, tagTone } from "@/admin/format";
import type { Memory } from "@/server/domain/memory/types";

export function MemoryView({
  rows,
}: {
  rows: { memory: Memory; versions: { at: string; by: string; reason: string }[] }[];
}) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Memory inspector</h1>
        <span className="muted mono">{rows.filter((row) => row.memory.status === "ACTIVE").length} actief</span>
      </div>
      <div className="table">
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: "1.6fr .7fr .6fr .6fr .5fr .7fr" }}>
            <span className="th">Feit</span>
            <span className="th">Domein</span>
            <span className="th">Confidence</span>
            <span className="th">Importance</span>
            <span className="th">Status</span>
            <span className="th">Versies</span>
          </div>
        </div>
        {rows.length ? (
          rows.map(({ memory, versions }) => (
            <div key={memory.id} className="tr" style={{ gridTemplateColumns: "1.6fr .7fr .6fr .6fr .5fr .7fr" }}>
              <div>
                <div className="td-main">{memory.normalizedFact}</div>
                <div className="td-sub">{memory.content}</div>
              </div>
              <span className="tag">{memory.domain}</span>
              <span className={`tag ${tagTone(memory.confidence)}`}>{memory.confidence}</span>
              <span className={`tag ${tagTone(memory.importance)}`}>{memory.importance}</span>
              <span className={`tag ${tagTone(memory.status)}`}>{memory.status}</span>
              <span className="mono muted">
                {versions.length} · {relTime(memory.lastObservedAt)}
              </span>
            </div>
          ))
        ) : (
          <div className="empty">Geen memories.</div>
        )}
      </div>
    </>
  );
}
