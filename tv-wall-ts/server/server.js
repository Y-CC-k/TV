/**
 * 電視牆伺服器（零相依，Node 內建模組）。
 *
 * 管理者把影片／圖片放進伺服器的 video／images 資料夾，
 * 用戶端（電視牆播放器）會定時向本伺服器取得清單並下載異動檔案。
 *
 * API：
 *   GET /            → 簡單狀態頁（現有檔案數）
 *   GET /manifest    → { videos: [{path,size,hash}], images: [{path,size,hash}], books: [{path,size,hash}] }
 *   GET /files/videos/<相對路徑>   → 影片檔
 *   GET /files/images/<相對路徑>  → 圖片檔
 *   GET /files/books/<相對路徑>   → 好書介紹圖片（books 分頁）
 *
 * 設定（可選）：專案根目錄 server.json，或命令列參數覆寫：
 *   node server/server.js --port 8123 --video server-media/video --images server-media/images --books server-media/books
 */
"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");

/* ---------- 設定 ---------- */

function argValue(name) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const cfg = { port: 8123, videoDir: "video", imagesDir: "images", booksDir: "books" };
try {
  Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(root, "server.json"), "utf8")));
} catch {
  // 沒有 server.json 就用預設值
}
if (argValue("port")) cfg.port = Number(argValue("port"));
if (argValue("video")) cfg.videoDir = argValue("video");
if (argValue("images")) cfg.imagesDir = argValue("images");
if (argValue("books")) cfg.booksDir = argValue("books");
if (cfg.booksDir === false) delete cfg.booksDir; // server.json 設 "booksDir": false 可停用

const videoDir = path.resolve(root, cfg.videoDir);
const imagesDir = path.resolve(root, cfg.imagesDir);
const booksDir = cfg.booksDir ? path.resolve(root, cfg.booksDir) : null;
const port = Number.isFinite(cfg.port) && cfg.port > 0 ? cfg.port : 8123;

const VIDEO_EXTS = new Set([".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".bmp", ".webp"]);

const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

/* ---------- 資料夾遞迴掃描 ---------- */

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) out.push(full);
    }
  }
  return out;
}

/* ---------- SHA-256 快取（mtime/size 沒變就直接沿用） ---------- */

const hashCache = new Map(); // abs path -> { mtimeMs, size, hash }

async function fileHash(abs) {
  const st = await fsp.stat(abs);
  const c = hashCache.get(abs);
  if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c;
  const h = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const r = fs.createReadStream(abs);
    r.on("data", (d) => h.update(d));
    r.on("end", resolve);
    r.on("error", reject);
  });
  const value = { mtimeMs: st.mtimeMs, size: st.size, hash: h.digest("hex") };
  hashCache.set(abs, value);
  return value;
}

async function buildList(dir, exts) {
  const files = walk(dir).filter((f) => exts.has(path.extname(f).toLowerCase()));
  const list = [];
  for (const f of files) {
    const info = await fileHash(f);
    list.push({
      path: path.relative(dir, f).replace(/\\/g, "/"),
      size: info.size,
      hash: info.hash,
    });
  }
  list.sort((a, b) => (a.path < b.path ? -1 : 1));
  return list;
}

/* ---------- HTTP 處理 ---------- */

function sendText(res, status, text, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(text);
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj, null, 2));
}

/** 安全地解析 /files/<kind>/<相對路徑>，回傳絕對路徑；不合法回傳 null */
function resolveFilePath(kind, rest) {
  const dir = kind === "videos" ? videoDir : kind === "images" ? imagesDir : kind === "books" ? booksDir : null;
  if (!dir) return null;
  let rel;
  try {
    rel = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (rel.includes("\\") || rel.includes("\0")) return null;
  const abs = path.resolve(dir, ...rel.split("/"));
  if (abs !== dir && !abs.startsWith(dir + path.sep)) return null; // 路徑穿越防護
  return abs;
}

async function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method Not Allowed");
      return;
    }

    if (pathname === "/" || pathname === "") {
      const v = await buildList(videoDir, VIDEO_EXTS);
      const i = await buildList(imagesDir, IMAGE_EXTS);
      const b = booksDir ? await buildList(booksDir, IMAGE_EXTS) : [];
      sendText(
        res,
        200,
        `TvWall 伺服器：${v.length} 個影片、${i.length} 張圖片、${b.length} 本好書介紹\n影片資料夾：${videoDir}\n圖片資料夾：${imagesDir}\n好書介紹資料夾：${booksDir ?? "（未設定）"}\n\nGET /manifest     取得檔案清單\nGET /files/...    下載檔案\n`,
      );
      return;
    }

    if (pathname === "/manifest") {
      const [videos, images, books] = await Promise.all([
        buildList(videoDir, VIDEO_EXTS),
        buildList(imagesDir, IMAGE_EXTS),
        booksDir ? buildList(booksDir, IMAGE_EXTS) : Promise.resolve(null),
      ]);
      sendJson(res, 200, { videos, images, books });
      return;
    }

    const filesMatch = /^\/files\/(videos|images|books)\/(.+)$/.exec(pathname);
    if (filesMatch) {
      const abs = resolveFilePath(filesMatch[1], filesMatch[2]);
      if (!abs) {
        sendText(res, 400, "Bad Request");
        return;
      }
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isFile()) {
        sendText(res, 404, "Not Found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream",
        "Content-Length": st.size,
        "Access-Control-Allow-Origin": "*",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = fs.createReadStream(abs);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      return;
    }

    sendText(res, 404, "Not Found");
  } catch (err) {
    console.error(`[server] ${req.method} ${url} 錯誤：`, err);
    sendText(res, 500, "Internal Server Error");
  }
}

/* ---------- 啟動 ---------- */

for (const dir of [videoDir, imagesDir, ...(booksDir ? [booksDir] : [])]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`[server] 無法建立資料夾 ${dir}：`, err);
    process.exit(1);
  }
}

const server = http.createServer((req, res) => {
  void handler(req, res).then(() => {
    console.log(`[server] ${new Date().toLocaleTimeString()} ${req.method} ${req.url}`);
  });
});

server.on("error", (err) => {
  console.error("[server] 無法啟動：", err.message);
  if (err.code === "EADDRINUSE") console.error(`[server] 連接埠 ${port} 已被使用`);
  process.exit(1);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[server] 電視牆伺服器已啟動：http://0.0.0.0:${port}（本機 http://127.0.0.1:${port}）`);
  console.log(`[server] 影片資料夾：${videoDir}`);
  console.log(`[server] 圖片資料夾：${imagesDir}`);
  console.log(`[server] 好書介紹資料夾：${booksDir ?? "（未設定）"}`);
  console.log("[server] 把檔案放進上面兩個資料夾即可，用戶端會定時抓 /manifest 並下載異動檔案");
});
