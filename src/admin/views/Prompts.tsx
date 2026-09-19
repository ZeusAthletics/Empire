import { EvalButton } from "@/admin/EvalButton";
import { NYX_CORE_VERSION } from "@/server/ai/prompts/nyx-core";

export function PromptsView({ version, compiled }: { version: string; compiled: string }) {
  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>Prompt register</h1>
        <EvalButton />
      </div>
      <div className="card gold">
        <span className="eyebrow">Actieve Nyx</span>
        <div className="kpi">
          <div className="v" style={{ margin: "6px 0 8px", fontSize: 22 }}>{version || NYX_CORE_VERSION}</div>
        </div>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          NyxRun.promptVersion logt deze waarde. Wijzigingen gaan via PersonaCompiler, nooit via een losse string.
        </p>
        <pre className="code">{compiled}</pre>
      </div>
    </>
  );
}
