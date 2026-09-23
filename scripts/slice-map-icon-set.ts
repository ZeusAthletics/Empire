import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SET_SLUG = process.argv[2] ?? "part-1";
const COLS = Number(process.argv[3] ?? 10);
const ROWS = Number(process.argv[4] ?? 10);
const BLACK_THRESHOLD = 28;

/** Turn near-black sheet padding transparent so pins don't show a square tile. */
async function stripDarkBackground(input: Buffer, width: number, height: number): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
      pixels[i + 3] = 0;
    }
  }
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  const root = path.join(process.cwd(), "public", "map-icons", SET_SLUG);
  const sheetPath = path.join(root, "sheet.jpg");
  const meta = await sharp(sheetPath).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("Sheet afmetingen onbekend.");

  const cellW = Math.floor(width / COLS);
  const cellH = Math.floor(height / ROWS);
  const outDir = path.join(root, "icons");
  await mkdir(outDir, { recursive: true });

  const labels: string[] = [];
  let index = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const left = col * cellW;
      const top = row * cellH;
      const id = String(index).padStart(2, "0");
      const tile = await sharp(sheetPath).extract({ left, top, width: cellW, height: cellH }).png().toBuffer();
      const transparent = await stripDarkBackground(tile, cellW, cellH);
      await sharp(transparent).toFile(path.join(outDir, `${id}.png`));
      labels.push(`${SET_SLUG}:${index}`);
      index += 1;
    }
  }

  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({ slug: SET_SLUG, cols: COLS, rows: ROWS, cellW, cellH, count: index }, null, 2),
  );
  console.log(`Sliced ${index} icons → public/map-icons/${SET_SLUG}/icons/ (${cellW}×${cellH})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
