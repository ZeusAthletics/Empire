import { compilePersona, DEFAULT_PERSONA } from "@/server/ai/prompts/persona";
import { getActivePersona } from "@/server/domain/persona/repository";

export const NYX_CORE_VERSION = `persona@${DEFAULT_PERSONA.version}`;

/** Fallback compiled persona when no ACTIVE row is stored. */
export const NYX_CORE = compilePersona(DEFAULT_PERSONA);

export async function loadNyxCore() {
  try {
    const active = await getActivePersona();
    if (active?.compiledPrompt.trim()) {
      return { core: active.compiledPrompt.trim(), version: `persona@${active.version}` };
    }
  } catch {
    /* table missing — use compiled default */
  }
  return { core: NYX_CORE, version: NYX_CORE_VERSION };
}
