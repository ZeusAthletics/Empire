const MAX_HTML_BYTES = 600_000;
const MAX_TEXT_CHARS = 14_000;
const FETCH_MS = 12_000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function stripHtml(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noScript
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
  return text.trim().slice(0, MAX_TEXT_CHARS);
}

export async function fetchUrlTextForNyx(rawUrl: string): Promise<{ ok: true; url: string; title: string; excerpt: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Ongeldige URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Alleen http(s)-links." };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: "Deze host is niet toegestaan." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "EmpireMode-Nyx/1.0 (link preview for player feedback)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, error: `Site antwoordde met ${response.status}.` };
    }
    const type = response.headers.get("content-type") ?? "";
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return { ok: false, error: "Pagina te groot om te scannen." };
    }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    let title = parsed.hostname;
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]) title = titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 200) || title;

    const excerpt = type.includes("text/html") ? stripHtml(raw) : raw.trim().slice(0, MAX_TEXT_CHARS);
    if (!excerpt) return { ok: false, error: "Geen leesbare tekst op deze pagina." };

    return { ok: true, url: parsed.toString(), title, excerpt };
  } catch {
    return { ok: false, error: "Site kon niet worden bereikt (timeout of geblokkeerd)." };
  } finally {
    clearTimeout(timer);
  }
}
