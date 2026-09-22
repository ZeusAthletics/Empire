export function mimeTypeFromStoragePath(path: string, fallbackType?: string): string {
  const type = fallbackType?.trim();
  if (type && type !== "application/octet-stream") return type;
  const lower = path.toLowerCase();
  if (/\.mp4$/i.test(lower)) return "video/mp4";
  if (/\.webm$/i.test(lower)) return "video/webm";
  if (/\.mov$/i.test(lower)) return "video/quicktime";
  if (/\.m4v$/i.test(lower)) return "video/x-m4v";
  if (/\.jpe?g$/i.test(lower)) return "image/jpeg";
  if (/\.png$/i.test(lower)) return "image/png";
  if (/\.webp$/i.test(lower)) return "image/webp";
  if (/\.gif$/i.test(lower)) return "image/gif";
  return type || "application/octet-stream";
}

export function isVideoStoragePath(path: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

export function mediaResponseHeaders(contentType: string, totalBytes: number): HeadersInit {
  return {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Length": String(totalBytes),
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": "inline",
  };
}

export function buildRangedMediaResponse(
  body: ArrayBuffer,
  storagePath: string,
  blobType: string | undefined,
  rangeHeader: string | null,
): Response {
  const total = body.byteLength;
  const resolvedType = mimeTypeFromStoragePath(storagePath, blobType);

  if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : total - 1;
      if (Number.isFinite(start) && start >= 0 && start < total) {
        const safeEnd = Math.min(end, total - 1);
        const slice = body.slice(start, safeEnd + 1);
        return new Response(slice, {
          status: 206,
          headers: {
            ...mediaResponseHeaders(resolvedType, slice.byteLength),
            "Content-Range": `bytes ${start}-${safeEnd}/${total}`,
          },
        });
      }
    }
  }

  return new Response(body, {
    status: 200,
    headers: mediaResponseHeaders(resolvedType, total),
  });
}
