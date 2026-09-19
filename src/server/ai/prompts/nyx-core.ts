import { compilePersona, DEFAULT_PERSONA } from "@/server/ai/prompts/persona";

export const NYX_CORE_VERSION = `persona@${DEFAULT_PERSONA.version}`;

/** Compiled persona. Services import this file, not ad-hoc prompt strings. */
export const NYX_CORE = compilePersona(DEFAULT_PERSONA);
