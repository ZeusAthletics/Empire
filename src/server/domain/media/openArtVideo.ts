const UA = "EmpireMode/1.0 (openart-i2v)";

/** Best-effort image-to-video via OpenArt session cookie. Returns null when unavailable. */
export async function imageToVideoFromStill(stillBytes: ArrayBuffer, sceneHint: string): Promise<ArrayBuffer | null> {
  const session = process.env.OPENART_SESSION?.trim();
  if (!session) return null;

  const b64 = Buffer.from(stillBytes).toString("base64");
  const body = {
    prompt: `Subtle motion, same person, ${sceneHint}. 4-8 seconds, cinematic, no face change.`,
    image: `data:image/jpeg;base64,${b64}`,
    duration: 6,
  };

  try {
    const response = await fetch("https://openart.ai/suite/api/image-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: session.startsWith("session=") ? session : `session=${session}`,
        "User-Agent": UA,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { videoUrl?: string; url?: string };
    const videoUrl = payload.videoUrl ?? payload.url;
    if (!videoUrl) return null;
    const video = await fetch(videoUrl, { headers: { "User-Agent": UA } });
    if (!video.ok) return null;
    return video.arrayBuffer();
  } catch {
    return null;
  }
}

export function openArtVideoEnabled(): boolean {
  return Boolean(process.env.OPENART_SESSION?.trim());
}
