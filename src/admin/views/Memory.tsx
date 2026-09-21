import Link from "next/link";
import { relTime, tagTone } from "@/admin/format";
import type { AdminMemoryRow } from "@/admin/data";
import { isMemoryPayload, type PublicProposal } from "@/server/domain/nyx/proposalTypes";

export function MemoryView({
  rows,
  memoryProposals,
  loadError,
  playerName,
  totalMemories,
}: {
  rows: AdminMemoryRow[];
  memoryProposals: PublicProposal[];
  loadError: string | null;
  playerName: string;
  totalMemories: number;
}) {
  const active = rows.filter((row) => row.memory.status === "ACTIVE").length;
  const pendingMem = memoryProposals.filter((item) => item.status === "PENDING");

  return (
    <div className="memory-page">
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Memory inspector
        </h1>
        <span className="muted mono">
          {playerName} · {active} actief · {totalMemories} totaal
          {totalMemories > rows.length ? ` · toont ${rows.length}` : ""}
        </span>
      </div>

      <p className="memory-explainer">
        Nyx voelt &quot;alsof ze veel weet&quot; door <strong>recente chat</strong> én onderstaande opgeslagen feiten.
        Na elk gesprek draait extractie: belangrijke feiten worden vaak eerst een <strong>voorstel</strong> (chips in
        chat) — pas na &quot;Onthouden&quot; of admin-goedkeuring komen ze in deze tabel. Alleen{" "}
        <strong>ACTIVE</strong> memories gaan structureel mee in prompts.
      </p>

      {loadError ? (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(240,82,82,.45)" }}>
          <span className="eyebrow" style={{ color: "var(--coral)" }}>
            Laden mislukt
          </span>
          <p className="body" style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>
            {loadError}
          </p>
        </div>
      ) : null}

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
          <div className="empty" role="status" style={{ minHeight: 120 }}>
            <div className="empty-title">Geen memories voor {playerName}</div>
            <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 520, margin: "0 auto", color: "var(--ink-3)" }}>
              Normaal na intake-bevestiging (STRATEGIC feiten) of wanneer Hardwig in Nyx-chat op &quot;Onthouden&quot; tikt.
              Seed vult geen demo-memories meer — chat met Nyx of rond intake af om rijen te zien.
            </div>
          </div>
        )}
      </div>

      {memoryProposals.length ? (
        <div style={{ marginTop: 18 }}>
          <div className="head" style={{ marginBottom: 8 }}>
            <h2 className="display" style={{ fontSize: 16 }}>
              Memory-voorstellen uit chat
            </h2>
            <span className="muted mono">{pendingMem.length} pending</span>
          </div>
          <div className="table">
            <div className="thead">
              <div className="tr" style={{ gridTemplateColumns: "1.4fr .7fr .6fr .5fr" }}>
                <span className="th">Feit</span>
                <span className="th">Soort</span>
                <span className="th">Status</span>
                <span className="th">Wanneer</span>
              </div>
            </div>
            {memoryProposals.map((proposal) => {
              const payload = isMemoryPayload(proposal.payload) ? proposal.payload : null;
              return (
                <div key={proposal.id} className="tr" style={{ gridTemplateColumns: "1.4fr .7fr .6fr .5fr" }}>
                  <div>
                    <div className="td-main">{payload?.normalizedFact ?? proposal.rationale}</div>
                    <div className="td-sub">{payload?.content ?? ""}</div>
                  </div>
                  <span className="tag">{proposal.kind}</span>
                  <span className={`tag ${tagTone(proposal.status)}`}>{proposal.status}</span>
                  <span className="mono muted">{relTime(proposal.createdAt)}</span>
                </div>
              );
            })}
          </div>
          {pendingMem.length ? (
            <p className="mono muted" style={{ marginTop: 10, fontSize: 11 }}>
              Goedkeuren kan in{" "}
              <Link href="/admin/proposals" style={{ color: "var(--gold-soft)" }}>
                Proposals
              </Link>{" "}
              of laat Hardwig &quot;Onthouden&quot; tikken in Nyx-chat.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
