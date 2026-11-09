// 由 images.jpg 產生 Windows 圖示 build/icon.ico 與 dist/icon.ico
// 用法：node scripts/make-icon.mjs（npm run build 會自動執行）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "images.jpg");
const outIco = [path.join(root, "build", "icon.ico"), path.join(root, "dist", "icon.ico")];
const sizes = [16, 24, 32, 48, 64, 128, 256]; // Windows 要求至少 256
const BASE = 256;

if (!fs.existsSync(source)) {
  console.warn(`找不到 ${source}，略過圖示產生`);
  process.exit(0);
}

const img = await Jimp.read(source);

// 等比縮放到剛好放進 256×256，再置中貼到透明畫布（避免變形）
const scale = Math.min(BASE / img.width, BASE / img.height);
const w = Math.round(img.width * scale);
const h = Math.round(img.height * scale);
const fitted = img.resize({ w, h });

const canvas = new Jimp({ width: BASE, height: BASE, color: 0x00000000 });
canvas.composite(fitted, Math.round((BASE - w) / 2), Math.round((BASE - h) / 2));

/** 各尺寸的 PNG 資料 */
const layers = [];
for (const size of sizes) {
  const layer = size === BASE ? canvas : canvas.clone().resize({ w: size, h: size });
  layers.push({ size, png: await layer.getBuffer("image/png") });
}

/** 組出 ICO 容器（內含 PNG 壓縮圖層，Vista 以上皆支援） */
function buildIco(items) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(items.length, 4);

  let offset = 6 + items.length * 16;
  const entries = [];
  for (const { size, png } of items) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 寬（0 代表 256）
    e.writeUInt8(size >= 256 ? 0 : size, 1); // 高
    e.writeUInt8(0, 2); // 調色盤數
    e.writeUInt8(0, 3); // 保留
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...items.map((i) => i.png)]);
}

const ico = buildIco(layers);
for (const out of outIco) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, ico);
}
console.log(
  `圖示已產生（來源 ${img.width}×${img.height} → ${sizes.join("/")}）：` +
    path.relative(root, outIco[0]),
);
