import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const source = "D:/tv-wall-client/icon.png";
const outIco = "D:/tv-wall-client/icon.ico";
const sizes = [16, 24, 32, 48, 64, 128, 256];
const BASE = 256;

const img = await Jimp.read(source);
const scale = Math.min(BASE / img.width, BASE / img.height);
const w = Math.round(img.width * scale);
const h = Math.round(img.height * scale);
const fitted = img.resize({ w, h });
const canvas = new Jimp({ width: BASE, height: BASE, color: 0x00000000 });
canvas.composite(fitted, Math.round((BASE - w) / 2), Math.round((BASE - h) / 2));

const layers = [];
for (const size of sizes) {
  const layer = size === BASE ? canvas : canvas.clone().resize({ w: size, h: size });
  layers.push({ size, png: await layer.getBuffer("image/png") });
}

function buildIco(items) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(items.length, 4);
  let offset = 6 + items.length * 16;
  const entries = [];
  for (const { size, png } of items) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...items.map((i) => i.png)]);
}

const ico = buildIco(layers);
fs.writeFileSync(outIco, ico);
console.log("done");
