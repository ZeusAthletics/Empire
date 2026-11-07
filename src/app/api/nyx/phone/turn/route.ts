import { getSessionPlayer } from "@/server/auth/session";
import { handleNyxPhoneTurnStream } from "@/server/ai/services/NyxPhoneService";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) {
    return new Response(JSON.stringify({ type: "error", error: "Niet aangemeld." }) + "\n", {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  try {
    const form = await request.formData();
    const callId = String(form.get("callId") ?? "").trim();
    const file = form.get("audio");
    if (!callId) {
      return new Response(JSON.stringify({ type: "error", error: "callId ontbreekt." }) + "\n", {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      });
    }
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ type: "error", error: "Audio ontbreekt." }) + "\n", {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) {
      return new Response(JSON.stringify({ type: "error", error: "Lege opname." }) + "\n", {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of handleNyxPhoneTurnStream({
            playerId: player.id,
            callId,
            audioBytes: bytes,
            filename: file.name || "call.webm",
            mimeType: file.type || "audio/webm",
          })) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Belbeurt mislukt.";
          console.error("[nyx/phone/turn]", message);
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: message })}\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Belbeurt mislukt.";
    console.error("[nyx/phone/turn]", message);
    return new Response(JSON.stringify({ type: "error", error: message }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }
}
