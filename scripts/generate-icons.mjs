import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NIGHT = [11, 9, 7];
const GOLD = [201, 163, 78];

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function inE(px, py, size) {
  const x = px / size;
  const y = py / size;
  const left = x >= 0.28 && x <= 0.4 && y >= 0.22 && y <= 0.78;
  const top = x >= 0.28 && x <= 0.72 && y >= 0.22 && y <= 0.34;
  const mid = x >= 0.28 && x <= 0.64 && y >= 0.46 && y <= 0.56;
  const bot = x >= 0.28 && x <= 0.72 && y >= 0.66 && y <= 0.78;
  return left || top || mid || bot;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const color = inE(x, y, size) ? GOLD : NIGHT;
      const i = row + 1 + x * 3;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
writeFileSync(join(dir, "icon-192.png"), png(192));
writeFileSync(join(dir, "icon-512.png"), png(512));
console.log("wrote public/icon-192.png and public/icon-512.png");
