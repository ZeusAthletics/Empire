import type { ReactNode } from "react";

export function EmptyInvite({
  eyebrow,
  body,
  action,
}: {
  eyebrow?: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flat" style={{ textAlign: "center", padding: "26px 16px" }}>
      {eyebrow ? <p className="eyebrow" style={{ margin: "0 0 8px" }}>{eyebrow}</p> : null}
      <p className="body" style={{ margin: action ? "0 0 12px" : 0 }}>
        {body}
      </p>
      {action}
    </div>
  );
}
