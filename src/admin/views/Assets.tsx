import { AssetApprove, AssetUploader } from "@/admin/AssetUploader";
import { Plate } from "@/components/ui/Plate";
import { publicMediaUrl, type MediaAsset } from "@/server/domain/media/repository";
import { relTime, tagTone } from "@/admin/format";

export function AssetsView({ assets }: { assets: MediaAsset[] }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Beeldmateriaal</h1>
        <span className="muted mono">ongekeurd = gradient op de telefoon</span>
      </div>
      <AssetUploader />
      <div className="agrid" style={{ marginTop: 14 }}>
        {assets.map((asset) => (
          <article key={asset.id} className="acard">
            <div className="thumb">
              <Plate
                kind="city"
                className="fill"
                src={asset.approved ? publicMediaUrl(asset.id) : undefined}
                approved={asset.approved}
              />
              <span className={`badge ${asset.approved ? "up" : "none"}`}>
                {asset.approved ? "LIVE" : "WACHT"}
              </span>
            </div>
            <div className="ab">
              <div className="td-main">{asset.kind}</div>
              <div className="td-sub">{relTime(asset.createdAt)}</div>
              <div style={{ marginTop: 8 }}>
                <span className={`tag ${tagTone(asset.approved ? "APPROVED" : "PENDING")}`}>
                  {asset.approved ? "goedgekeurd" : "ongekeurd"}
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <AssetApprove id={asset.id} approved={asset.approved} />
              </div>
            </div>
          </article>
        ))}
      </div>
      {!assets.length ? <div className="empty">Nog geen uploads.</div> : null}
    </>
  );
}
