import type { PublicCampaign } from "@/server/domain/campaign/types";
import type { PublicMission } from "@/server/domain/mission/types";
import type { SessionPlayer } from "@/server/domain/player/types";
import { tagTone } from "@/admin/format";

export function CampaignView({
  campaign,
  missions,
  counts,
  stats,
}: {
  campaign: PublicCampaign | null;
  missions: PublicMission[];
  counts: Record<string, number>;
  stats: SessionPlayer["stats"];
}) {
  const chapter = campaign?.chapter;
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Campaign</h1>
        <span className="muted mono">{campaign?.title ?? "geen campagne"}</span>
      </div>
      <div className="grid g3">
        <div className="card gold">
          <span className="eyebrow">Hoofdstuk</span>
          <div className="kpi">
            <div className="v" style={{ margin: "6px 0 8px" }}>
              {chapter ? `${chapter.roman} ${chapter.name}` : "—"}
            </div>
          </div>
          <div className="mono muted">
            {chapter
              ? `€${chapter.economicCurrent.toLocaleString("nl-BE")} van €${chapter.economicTo.toLocaleString("nl-BE")}`
              : ""}
          </div>
        </div>
        <div className="card">
          <span className="eyebrow">Bottleneck</span>
          <div className="kpi">
            <div className="v" style={{ margin: "6px 0 8px" }}>{campaign?.bottleneckStat ?? "—"}</div>
          </div>
          <div className="quote">{campaign?.bottleneckReason ?? ""}</div>
        </div>
        <div className="card">
          <span className="eyebrow">Missies</span>
          <div className="chiprow" style={{ marginTop: 10 }}>
            {Object.entries(counts).map(([status, count]) => (
              <span key={status} className={`tag ${tagTone(status)}`}>
                {status} {count}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <span className="eyebrow">Stats</span>
        <div className="grid g4" style={{ marginTop: 10 }}>
          {stats.map((stat) => (
            <div key={stat.key}>
              <div className="mono muted">{stat.key}</div>
              <div className="kpi"><div className="v" style={{ fontSize: 22 }}>{stat.value}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="table" style={{ marginTop: 12 }}>
        <div className="thead">
          <div className="tr" style={{ gridTemplateColumns: "1.6fr .6fr .5fr .5fr" }}>
            <span className="th">Missie</span>
            <span className="th">Track</span>
            <span className="th">Status</span>
            <span className="th">XP</span>
          </div>
        </div>
        {missions.map((mission) => (
          <div key={mission.id} className="tr" style={{ gridTemplateColumns: "1.6fr .6fr .5fr .5fr" }}>
            <div className="td-main">{mission.title}</div>
            <span className="tag">{mission.track}</span>
            <span className={`tag ${tagTone(mission.status)}`}>{mission.status}</span>
            <span className="mono muted">{mission.xpReward}</span>
          </div>
        ))}
      </div>
    </>
  );
}
