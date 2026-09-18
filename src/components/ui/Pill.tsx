import type { ReactNode } from "react";

export function Pill({ icon, val, lab }: { icon: ReactNode; val: string; lab: string }) {
  return (
    <div className="pill">
      <span className="ico">{icon}</span>
      <span>
        <span className="val">{val}</span>
        <br />
        <span className="lab">{lab}</span>
      </span>
    </div>
  );
}
