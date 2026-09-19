import { ProposalActions } from "@/admin/ProposalActions";
import { relTime, tagTone } from "@/admin/format";
import type { PublicProposal } from "@/server/domain/nyx/proposalTypes";

function titleOf(proposal: PublicProposal) {
  const payload = proposal.payload as { title?: string; normalizedFact?: string; content?: string };
  return payload.title ?? payload.normalizedFact ?? payload.content ?? proposal.kind;
}

export function ProposalsView({ proposals }: { proposals: PublicProposal[] }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Proposal queue</h1>
        <span className="muted mono">{proposals.filter((item) => item.status === "PENDING").length} open</span>
      </div>
      <div className="table">
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: "1.4fr .7fr .6fr .5fr 1.4fr" }}>
            <span className="th">Voorstel</span>
            <span className="th">Soort</span>
            <span className="th">Status</span>
            <span className="th">Wanneer</span>
            <span className="th">Actie</span>
          </div>
        </div>
        {proposals.length ? (
          proposals.map((proposal) => (
            <div key={proposal.id} className="tr" style={{ gridTemplateColumns: "1.4fr .7fr .6fr .5fr 1.4fr" }}>
              <div>
                <div className="td-main">{titleOf(proposal)}</div>
                <div className="td-sub">{proposal.rationale}</div>
              </div>
              <span className="tag">{proposal.kind}</span>
              <span className={`tag ${tagTone(proposal.status)}`}>{proposal.status}</span>
              <span className="mono muted">{relTime(proposal.createdAt)}</span>
              <ProposalActions id={proposal.id} status={proposal.status} />
            </div>
          ))
        ) : (
          <div className="empty">Geen voorstellen.</div>
        )}
      </div>
    </>
  );
}
