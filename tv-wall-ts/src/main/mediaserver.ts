/**
 * 內建媒體伺服器：與播放器同一個 Electron 主程序內執行（無黑色文字視窗、目標機器不需 Node.js）。
 * 用 config.json 的 serverMode 開關：
 *   - 開啟後提供 POST /upload（可傳 type=video|image|book）、GET /files、刪除與下載檔案
 *   - 供「tv-wall-client 電視牆用戶端上傳工具」把影片／照片／好書介紹上傳到本機資料夾
 *   - 上傳完成的檔案立刻被播放器重掃，放進播放輪替／書籍清單
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import formidable from "formidable";
import { IMAGE_EXTS, VIDEO_EXTS } from "./media";

export interface MediaServerOptions {
  videoDir: string;
  imagesDir: string;
  /** 好書介紹圖片資料夾（books 分頁；未提供＝不服務此分類） */
  booksDir?: string;
  /** 校園風雲圖片資料夾（campus 分頁；未提供＝不服務此分類） */
  campusDir?: string;
  /** 衛教宣導圖片資料夾（health 分頁；未提供＝不服務此分類） */
  healthDir?: string;
  port: number;
  /** config.json 的完整路徑（提供時啟用 GET /config 與 POST /config 修改分頁顯示設定） */
  configPath?: string;
  /** 上傳完成後的回調（由主程序傳入，用於通知 renderer 重新掃描） */
  onUploaded?: () => void;
}

/** tabs：正規化分頁顯示設定（未填視為顯示；只允許 tv／honor／books 三個鍵） */
function normalizeTabs(raw: unknown): { tv: boolean; honor: boolean; books: boolean } {
  const t = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    tv: t.tv !== false,
    honor: t.honor !== false,
    books: t.books !== false,
  };
}

const CONTENT_TYPES: Record<string, string> = {
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

/* ---------- 掃描與 hash（SHA-256 快取，mtime/size 沒變直接沿用） ---------- */

function walk(dir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    let entries: fs.Dirent[];
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

const HASH_CACHE = new Map<string, { mtimeMs: number; size: number; hash: string }>();

async function fileHash(abs: string): Promise<{ size: number; hash: string }> {
  const st = await fsp.stat(abs);
  const c = HASH_CACHE.get(abs);
  if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c;
  const h = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const r = fs.createReadStream(abs);
    r.on("data", (d: Buffer) => h.update(d));
    r.on("end", () => resolve());
    r.on("error", reject);
  });
  const value = { mtimeMs: st.mtimeMs, size: st.size, hash: h.digest("hex") };
  HASH_CACHE.set(abs, value);
  return { size: st.size, hash: value.hash };
}

async function buildList(dir: string, exts: Set<string>): Promise<Array<{ path: string; size: number; hash: string }>> {
  const files = walk(dir).filter((f) => exts.has(path.extname(f).toLowerCase()));
  const list: Array<{ path: string; size: number; hash: string }> = [];
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

/* ---------- HTTP 回應 ---------- */

function sendText(res: http.ServerResponse, status: number, text: string): void {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function sendJson(res: http.ServerResponse, obj: unknown): void {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(obj, null, 2));
}

/** 分類名稱 → 實體資料夾（books 未提供時回傳 null） */
function dirForKind(kind: string, o: MediaServerOptions): string | null {
  if (kind === "videos") return o.videoDir;
  if (kind === "images") return o.imagesDir;
  if (kind === "books") return o.booksDir ?? null;
  if (kind === "campus") return o.campusDir ?? null;
  if (kind === "health") return o.healthDir ?? null;
  return null;
}

/** 安全解析 /files/<videos|images|books>/<相對路徑>；不合法回傳 null */
function resolveFilePath(kind: string, rest: string, o: MediaServerOptions): string | null {
  const dir = dirForKind(kind, o);
  if (!dir) return null;
  let rel: string;
  try {
    rel = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (rel.includes("\\") || rel.includes("\0") || rel.includes("..")) return null;
  const abs = path.resolve(dir, ...rel.split("/"));
  if (abs !== dir && !abs.startsWith(dir + path.sep)) return null; // 路徑穿越防護
  return abs;
}

/** 本機的區網 IPv4（顯示在啟動訊息，供填入用戶端 config.json） */
function localIPv4s(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

/** 啟動內建伺服器（不回傳太複雜的東西；失敗時只記 log，不影響播放功能） */
export function startMediaServer(o: MediaServerOptions): void {
  for (const dir of [o.videoDir, o.imagesDir, ...(o.booksDir ? [o.booksDir] : []), ...(o.campusDir ? [o.campusDir] : []), ...(o.healthDir ? [o.healthDir] : [])]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`[server] 無法建立資料夾 ${dir}：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const handler = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    try {
      if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST" && req.method !== "DELETE") {
        sendText(res, 405, "Method Not Allowed");
        return;
      }

      /* ---------- 上傳檔案（支援單一或多個） ---------- */
      if (pathname === "/upload" && req.method === "POST") {
        const form = formidable({ multiples: true, keepExtensions: true });
        form.parse(req, async (err: any, fields: any, files: any) => {
          if (err) {
            console.error("[server] 上傳解析失敗：", err);
            sendText(res, 500, "上傳解析失敗：" + err.message);
            return;
          }

          // 正規化欄位：type 可能為單一字串或陣列（video／image／book）
          const typeRaw = fields.type;
          const types = Array.isArray(typeRaw) ? typeRaw : [typeRaw];
          const defaultType = (types[0] || "image") === "video" ? "video" : "image";

          // 正規化檔案：files.file 可能為單一物件或陣列
          const uploaded = files.file;
          if (!uploaded) {
            sendText(res, 400, "未收到檔案（欄位名稱須為 file）");
            return;
          }
          const fileEntries = Array.isArray(uploaded) ? uploaded : [uploaded];

          const results: Array<any> = [];
          let hasError = false;
          let firstErrorMsg = "";

          for (let i = 0; i < fileEntries.length; i++) {
            const fileEntry = fileEntries[i];
            const origName = fileEntry.originalFilename || `upload_${i}`;
            const ext = path.extname(origName).toLowerCase();

            // 每個檔案可對應各自的 type，沒給則用預設
            const rawType = types[i] || defaultType;
            const fileType: "video" | "image" | "book" | "campus" | "health" =
              rawType === "video" ? "video" : rawType === "book" ? "book" : rawType === "campus" ? "campus" : rawType === "health" ? "health" : "image";
            const targetDir =
              fileType === "video" ? o.videoDir
              : fileType === "book" ? o.booksDir
              : fileType === "campus" ? o.campusDir
              : fileType === "health" ? o.healthDir
              : o.imagesDir;
            const allowedExts = fileType === "image" || fileType === "book" || fileType === "campus" || fileType === "health" ? IMAGE_EXTS : VIDEO_EXTS;

            if (!targetDir) {
              hasError = true;
              firstErrorMsg = `未設定 books 資料夾，無法上傳好書介紹（檔案：${origName}）`;
              results.push({ ok: false, name: origName, error: firstErrorMsg });
              continue;
            }
            if (!allowedExts.has(ext)) {
              hasError = true;
              firstErrorMsg = `不支援的副檔名 ${ext}（檔案：${origName}）`;
              results.push({ ok: false, name: origName, error: firstErrorMsg });
              continue;
            }

            // 避免同名覆蓋：若存在則加序號
            let saveName = origName;
            let counter = 1;
            while (fs.existsSync(path.join(targetDir, saveName))) {
              const base = path.basename(origName, ext);
              saveName = `${base}_${counter}${ext}`;
              counter++;
            }
            const savePath = path.join(targetDir, saveName);

            try {
              // 跨磁碟機無法用 rename，改用串流複製後刪除暫存檔
              await new Promise<void>((resolve, reject) => {
                const src = fs.createReadStream(fileEntry.filepath);
                const dst = fs.createWriteStream(savePath);
                src.on("error", reject);
                dst.on("error", reject);
                dst.on("finish", () => resolve());
                src.pipe(dst);
              });
              await fsp.unlink(fileEntry.filepath).catch(() => undefined);

              const stat = await fsp.stat(savePath);
              const info = await fileHash(savePath);
              // 清掉 hash 快取，強制下次 manifest 重新計算（新檔案）
              HASH_CACHE.delete(savePath);

              console.log(`[server] 上傳完成：${savePath}（${stat.size} bytes）`);
              results.push({
                ok: true,
                name: saveName,
                path: (fileType === "video" ? "videos/" : fileType === "book" ? "books/" : fileType === "campus" ? "campus/" : fileType === "health" ? "health/" : "images/") + saveName,
                size: stat.size,
                hash: info.hash,
                type: fileType,
              });
            } catch (saveErr) {
              console.error("[server] 儲存上傳檔案失敗：", saveErr);
              hasError = true;
              firstErrorMsg = (saveErr instanceof Error ? saveErr.message : String(saveErr));
              results.push({ ok: false, name: origName, error: firstErrorMsg });
            }
          }

          if (hasError) {
            // 部分失敗仍回 200，讓前端詳細顯示每個檔案結果
            sendJson(res, { ok: false, results, message: firstErrorMsg });
            return;
          }

          // 全部成功
          o.onUploaded?.();

          sendJson(res, { ok: true, results });
        });
        return;
      }

      /* ---------- 讀取分頁顯示設定（config.json 的 tabs 區塊） ---------- */
      if (pathname === "/config" && req.method === "GET") {
        if (!o.configPath) {
          sendText(res, 404, "找不到 config.json");
          return;
        }
        try {
          const raw = JSON.parse(fs.readFileSync(o.configPath, "utf8").replace(/^\uFEFF/, ""));
          sendJson(res, { ok: true, tabs: normalizeTabs(raw.tabs) });
        } catch (e) {
          sendText(res, 500, "讀取 config.json 失敗：" + (e instanceof Error ? e.message : String(e)));
        }
        return;
      }

      /* ---------- 更新分頁顯示設定（寫回 config.json，播放器會自動套用） ---------- */
      if (pathname === "/config" && req.method === "POST") {
        const chunks: Buffer[] = [];
        let total = 0;
        req.on("data", (d: Buffer) => {
          total += d.length;
          if (total > 1024 * 1024) {
            req.destroy();
            return;
          }
          chunks.push(d);
        });
        req.on("end", () => {
          try {
            let body: { tabs?: unknown } = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
              sendText(res, 400, "無效的 JSON");
              return;
            }
            const tabs = normalizeTabs(body.tabs);
            let cfg: Record<string, unknown> = {};
            try {
              cfg = JSON.parse(fs.readFileSync(o.configPath as string, "utf8").replace(/^\uFEFF/, "")) || {};
            } catch {
              /* 檔案不存在或解析失敗就整份重建 */
            }
            cfg.tabs = tabs;
            fs.writeFileSync(o.configPath as string, JSON.stringify(cfg, null, 2) + "\n", "utf8");
            console.log(`[server] tabDisplay update: ${JSON.stringify(tabs)}`);
            sendJson(res, { ok: true, tabs });
          } catch (e) {
            sendText(res, 500, "寫入 config.json 失敗：" + (e instanceof Error ? e.message : String(e)));
          }
        });
        return;
      }

      if (pathname === "/" || pathname === "") {
        const v = await buildList(o.videoDir, VIDEO_EXTS);
        const i = await buildList(o.imagesDir, IMAGE_EXTS);
        const b = o.booksDir ? await buildList(o.booksDir, IMAGE_EXTS) : [];
        const c = o.campusDir ? await buildList(o.campusDir, IMAGE_EXTS) : [];
        const h = o.healthDir ? await buildList(o.healthDir, IMAGE_EXTS) : [];
        sendText(res, 200, `電視牆伺服器：${v.length} 個影片、${i.length} 張圖片、${b.length} 本好書介紹、${c.length} 則校園風雲、${h.length} 則衛教宣導\n影片資料夾：${o.videoDir}\n圖片資料夾：${o.imagesDir}\n好書介紹資料夾：${o.booksDir ?? "（未設定）"}\n校園風雲資料夾：${o.campusDir ?? "（未設定）"}\n衛教宣導資料夾：${o.healthDir ?? "（未設定）"}\n\nGET /files        列出所有可播放檔案（上傳工具介面用）\nGET /files/...    下載檔案\nPOST /upload      上傳檔案（multipart/form-data，欄位 file + type=video|image|book|campus|health）\nDELETE /files/:type/:name  刪除檔案\nGET /config       讀取分頁顯示設定\nPOST /config      更新分頁顯示設定（JSON：{ "tabs": { "tv": true, "honor": true, "books": true, "campus": true, "health": true } }）\n`);
        return;
      }

      /* ---------- 檔案清單（供用戶端 GUI 顯示） ---------- */
      if (pathname === "/files" && req.method === "GET") {
        const [videos, images, books, campus, health] = await Promise.all([
          buildList(o.videoDir, VIDEO_EXTS),
          buildList(o.imagesDir, IMAGE_EXTS),
          o.booksDir ? buildList(o.booksDir, IMAGE_EXTS) : Promise.resolve([]),
          o.campusDir ? buildList(o.campusDir, IMAGE_EXTS) : Promise.resolve([]),
          o.healthDir ? buildList(o.healthDir, IMAGE_EXTS) : Promise.resolve([]),
        ]);
        sendJson(res, {
          videos: videos.map(f => ({ name: path.basename(f.path), size: f.size, type: "video", path: f.path })),
          images: images.map(f => ({ name: path.basename(f.path), size: f.size, type: "image", path: f.path })),
          books: books.map(f => ({ name: path.basename(f.path), size: f.size, type: "book", path: f.path })),
          campus: campus.map(f => ({ name: path.basename(f.path), size: f.size, type: "campus", path: f.path })),
          health: health.map(f => ({ name: path.basename(f.path), size: f.size, type: "health", path: f.path })),
        });
        return;
      }

      if (pathname === "/manifest") {
        const [videos, images, books, campus, health] = await Promise.all([
          buildList(o.videoDir, VIDEO_EXTS),
          buildList(o.imagesDir, IMAGE_EXTS),
          o.booksDir ? buildList(o.booksDir, IMAGE_EXTS) : Promise.resolve([]),
          o.campusDir ? buildList(o.campusDir, IMAGE_EXTS) : Promise.resolve([]),
          o.healthDir ? buildList(o.healthDir, IMAGE_EXTS) : Promise.resolve([]),
        ]);
        sendJson(res, { videos, images, books, campus, health });
        return;
      }

      /* ---------- 下載／刪除單一檔案 ---------- */
      const filesMatch = /^\/files\/(videos|images|books|campus|health)\/(.+)$/.exec(pathname);
      if (filesMatch) {
        if (req.method === "DELETE") {
          const abs = resolveFilePath(filesMatch[1], filesMatch[2], o);
          if (!abs) {
            sendText(res, 400, "Bad Request");
            return;
          }
          try {
            await fsp.rm(abs, { force: true });
            HASH_CACHE.delete(abs);
            sendText(res, 200, "Deleted");
          } catch (delErr) {
            sendText(res, 500, "刪除失敗：" + (delErr instanceof Error ? delErr.message : String(delErr)));
          }
          return;
        }
        const abs = resolveFilePath(filesMatch[1], filesMatch[2], o);
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
  };

  const server = http.createServer((req, res) => {
    void handler(req, res).then(() => {
      console.log(`[server] ${new Date().toLocaleTimeString()} ${req.method} ${req.url}`);
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(`[server] 內建伺服器啟動失敗：${err.message}${err.code === "EADDRINUSE" ? `（連接埠 ${o.port} 已被使用）` : ""}`);
  });

  server.listen(o.port, "0.0.0.0", () => {
    console.log(`[server] 內建媒體伺服器已啟動：連接埠 ${o.port}`);
    console.log(`[server] 影片資料夾：${o.videoDir}`);
    console.log(`[server] 圖片資料夾：${o.imagesDir}`);
    console.log(`[server] 好書介紹資料夾：${o.booksDir ?? "（未設定）"}`);
    const ips = localIPv4s();
    console.log(`[server] 用戶端 serverUrl 請填：http://${ips[0] ?? "本機IP"}:${o.port}${ips.length > 1 ? `（其他 IP：${ips.slice(1).join("、")}）` : ""}`);
  });
}
