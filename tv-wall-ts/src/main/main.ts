import { app, BrowserWindow, ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { IMAGE_EXTS, VIDEO_EXTS } from "./media";
import { startMediaServer } from "./mediaserver";

/** 除錯用：在頁面內取得播放狀態（TVWALL_DUMP） */
const DIAG_JS = `(() => {
  const v = document.getElementById("video");
  const i = document.getElementById("image");
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  };
  return {
    title: document.title,
    rootClass: document.getElementById("root").className,
    viewport: [window.innerWidth, window.innerHeight],
    videoRect: rect(v),
    imageRect: rect(i),
    videoSrc: v.currentSrc,
    videoReadyState: v.readyState,
    videoPaused: v.paused,
    videoError: v.error ? v.error.message : null,
    videoSize: [v.videoWidth, v.videoHeight],
    videoTime: Math.round(v.currentTime * 10) / 10,
    imageSrc: i.currentSrc,
    imageOk: i.complete && i.naturalWidth > 0,
    imageSize: [i.naturalWidth, i.naturalHeight],
    videoFit: getComputedStyle(v).objectFit,
    imageFit: getComputedStyle(i).objectFit,
    videoMsg: document.getElementById("videoMsg").textContent,
    imageMsg: document.getElementById("imageMsg").textContent,
    bodyClass: document.body.className,
    tabBarHidden: document.getElementById("tabBar").classList.contains("hhidden") || document.getElementById("tabBar").classList.contains("hidden"),
    tabTvActive: document.getElementById("tabTv").classList.contains("active"),
    tabHonorActive: document.getElementById("tabHonor").classList.contains("active"),
    tabBooksActive: document.getElementById("tabBooks") ? document.getElementById("tabBooks").classList.contains("active") : null,
    booksPageHidden: document.getElementById("booksPage") ? document.getElementById("booksPage").classList.contains("hidden") : null,
    bookSettingsSet: !!window.BOOK_SETTINGS,
    bookCounter: (function () {
      const c = document.getElementById("bookCounter");
      return c ? c.textContent : null;
    })(),
    booksMsg: (function () {
      const m = document.getElementById("booksMsg");
      return m ? m.textContent : null;
    })(),
    honorSettingsSet: !!window.HONOR_SETTINGS,
    honorScoringChildren: document.getElementById("scoring") ? document.getElementById("scoring").children.length : -1,
    honorScoringText: (function () {
      const s = document.getElementById("scoring");
      if (!s) return null;
      const t = s.textContent || "";
      return t.slice(0, 120);
    })(),
    honorToast: (function () {
      const t = document.getElementById("honorToast");
      return t ? t.textContent : null;
    })(),
  };
})()`;

let win: BrowserWindow | null = null;

/** 程式根目錄：開發時＝專案資料夾，打包後＝exe 所在資料夾 */
function appRoot(): string {
  return app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
}

/** config.json 的內容（全部選填） */
interface FileConfig {
  videoDir?: string;
  imagesDir?: string;
  /** 好書介紹（books 分頁）圖片資料夾 */
  booksDir?: string;
  /** 校園風雲（campus 分頁）圖片資料夾 */
  campusDir?: string;
  /** 衛教宣導（health 分頁）圖片資料夾 */
  healthDir?: string;
  /** 好書介紹每頁停留毫秒 */
  bookIntervalMs?: number;
  /** 校園風雲每頁停留毫秒 */
  campusIntervalMs?: number;
  /** 衛教宣導每頁停留毫秒 */
  healthIntervalMs?: number;
  imageIntervalMs?: number;
  videoFit?: FitMode;
  imageFit?: FitMode;
  /** 本機是否同時當「電視牆伺服器」（接受 tv-wall-client 上傳，服務本機自己的 video／images／books） */
  serverMode?: boolean;
  /** 內建伺服器使用的連接埠 */
  serverPort?: number;
  /** 啟動時的預設分頁："tv" 或 "honor" */
  defaultTab?: string;
  /** 各分頁顯示／隱藏（false＝隱藏；未填視為顯示） */
  tabs?: TabVisibility;
  /** 積點排行（榮譽系統）設定區塊 */
  honor?: HonorSettings;
}

/** 解析後的設定（含實際使用的資料夾路徑） */
interface ResolvedConfig extends AppConfig {
  videoDir: string;
  imagesDir: string;
  booksDir: string;
  campusDir: string;
  healthDir: string;
  serverMode: boolean;
  serverPort: number;
  /** 實際讀到的 config.json 完整路徑（找不到檔案時為空字串） */
  configPath: string;
}

/** 讀取 config.json 並補上預設值（找不到檔案時全用預設值） */
function resolveConfig(): ResolvedConfig {
  const root = appRoot();
  let raw: FileConfig = {};
  let readPath = "";
  // 嘗試多個可能的 config.json 位置（打包後可能在 exe 旁或 resources 目錄）
  const candidatePaths = [
    path.join(root, "config.json"),
    path.join(process.resourcesPath, "config.json"),
  ];
  for (const p of candidatePaths) {
    try {
      raw = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as FileConfig;
      readPath = p;
      break;
    } catch {
      // 繼續嘗試下一個
    }
  }
  if (!readPath) {
    // 記錄讀取失敗，方便除錯
    try {
      fs.appendFileSync(path.join(root, "tvwall-config-debug.log"), new Date().toISOString() + " config.json not found at " + candidatePaths.join(", ") + "\n");
    } catch { }
  }

  const dir = (value: string | undefined, fallback: string): string => {
    const v = value && value.trim() ? value.trim() : fallback;
    return path.isAbsolute(v) ? v : path.resolve(root, v);
  };

  const videoDir = dir(raw.videoDir, "video");
  const imagesDir = dir(raw.imagesDir, "images");
  const booksDir = dir(raw.booksDir, "books");
  const campusDir = dir(raw.campusDir, "campus");
  const healthDir = dir(raw.healthDir, "health");

  return {
    configPath: readPath,
    videoDir,
    imagesDir,
    booksDir,
    campusDir,
    healthDir,
    imageIntervalMs:
      typeof raw.imageIntervalMs === "number" && raw.imageIntervalMs > 0
        ? raw.imageIntervalMs
        : 5000,
    bookIntervalMs:
      typeof raw.bookIntervalMs === "number" && raw.bookIntervalMs > 0
        ? raw.bookIntervalMs
        : 8000,
    campusIntervalMs:
      typeof raw.campusIntervalMs === "number" && raw.campusIntervalMs > 0
        ? raw.campusIntervalMs
        : 8000,
    healthIntervalMs:
      typeof raw.healthIntervalMs === "number" && raw.healthIntervalMs > 0
        ? raw.healthIntervalMs
        : 8000,
    videoFit: raw.videoFit ?? "contain",
    imageFit: raw.imageFit ?? "fill",
    serverMode: raw.serverMode ?? false,
    serverPort:
      typeof raw.serverPort === "number" && raw.serverPort > 0 ? raw.serverPort : 8123,
    defaultTab: raw.defaultTab === "honor" ? "honor" : "tv",
    tabs:
      raw.tabs && typeof raw.tabs === "object"
        ? {
            tv: raw.tabs.tv !== false,
            honor: raw.tabs.honor !== false,
            books: raw.tabs.books !== false,
            campus: raw.tabs.campus !== false,
            health: raw.tabs.health !== false,
          }
        : { tv: true, honor: true, books: true, campus: true, health: true },
    honor:
      raw.honor && typeof raw.honor === "object"
        ? {
            supabaseUrl: String(raw.honor.supabaseUrl).trim(),
            publishableKey: String(raw.honor.publishableKey).trim(),
            schoolId: String(raw.honor.schoolId ?? "").trim(),
            topN: typeof raw.honor.topN === "number" ? raw.honor.topN : 10,
          }
        : undefined,
  };
}

/** 本機的區網 IPv4（供渲染程序顯示在畫面右上角） */
function localIPv4s(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

/** 只給渲染程序看的設定（不含本機路徑） */
function publicConfig(c: ResolvedConfig): AppConfig {
  return {
    imageIntervalMs: c.imageIntervalMs,
    bookIntervalMs: c.bookIntervalMs,
    campusIntervalMs: c.campusIntervalMs,
    healthIntervalMs: c.healthIntervalMs,
    videoFit: c.videoFit,
    imageFit: c.imageFit,
    defaultTab: c.defaultTab,
    tabs: c.tabs,
    honor: c.honor,
    localIP: localIPv4s()[0] ?? "",
  };
}

/** 自然排序鍵（數字依數值比，其餘忽略大小寫），對應原 Python 的 natural_key */
function naturalKey(s: string): Array<number | string> {
  return s
    .split(/(\d+)/)
    .map((t) => (/^\d+$/.test(t) ? Number(t) : t.toLowerCase()));
}

function compareKeys(a: Array<number | string>, b: Array<number | string>): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else if (typeof x === "string" && typeof y === "string") {
      if (x !== y) return x < y ? -1 : 1;
    } else {
      return typeof x === "number" ? -1 : 1; // 數字排在文字前
    }
  }
  return a.length - b.length;
}

/** 遞迴列出資料夾內所有檔案（對應 Path.rglob("*")） */
function walk(folder: string): string[] {
  const out: string[] = [];
  const stack: string[] = [folder];
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

/** 收集資料夾中指定副檔名的檔案，依相對路徑自然排序 */
function collect(folder: string, exts: Set<string>): MediaItem[] {
  if (!fs.existsSync(folder)) return [];
  const files = walk(folder).filter((f) => exts.has(path.extname(f).toLowerCase()));
  files.sort((a, b) =>
    compareKeys(naturalKey(path.relative(folder, a)), naturalKey(path.relative(folder, b))),
  );
  return files.map((f) => ({ url: pathToFileURL(f).href, name: path.basename(f) }));
}

/* ---------- IPC ---------- */

function setupIpc(): void {
  ipcMain.handle("scan", () => {
    const cfg = resolveConfig();
    try {
      fs.mkdirSync(cfg.videoDir, { recursive: true });
      fs.mkdirSync(cfg.imagesDir, { recursive: true });
      fs.mkdirSync(cfg.booksDir, { recursive: true });
      fs.mkdirSync(cfg.campusDir, { recursive: true });
      fs.mkdirSync(cfg.healthDir, { recursive: true });
    } catch {
      // 無法建立資料夾就視為不存在，交給 collect 回傳空陣列
    }
    return {
      videos: collect(cfg.videoDir, VIDEO_EXTS),
      images: collect(cfg.imagesDir, IMAGE_EXTS),
      books: collect(cfg.booksDir, IMAGE_EXTS),
      campus: collect(cfg.campusDir, IMAGE_EXTS),
      health: collect(cfg.healthDir, IMAGE_EXTS),
    } as ScanResult;
  });

  ipcMain.handle("config", () => {
    const resolved = resolveConfig() as ResolvedConfig & { _debugHonorRaw?: string; _debugRoot?: string };
    const cfg = publicConfig(resolved);
    try {
      const debug = {
        ...cfg,
        _debugHonorRaw: resolved._debugHonorRaw,
        _debugRoot: resolved._debugRoot,
        _rawHonorExists: !!resolved.honor,
        _rawHonorSupabaseUrl: resolved.honor ? resolved.honor.supabaseUrl : null,
        _rawHonorPublishableKey: resolved.honor ? resolved.honor.publishableKey : null,
        _rawDefaultTab: resolved.defaultTab,
      };
      fs.writeFileSync(path.join(appRoot(), "tvwall-config-debug.json"), JSON.stringify(debug, null, 2));
    } catch { }
    return cfg;
  });

  ipcMain.handle("close", () => {
    if (win && !win.isDestroyed()) win.close();
    else app.quit();
  });

  ipcMain.handle("toggle-fullscreen", () => {
    if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    show: false,
    // 工作列／視窗圖示（dist/icon.ico，由 scripts/make-icon.mjs 依 images.jpg 產生）
    icon: path.join(__dirname, "..", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setFullScreen(true);
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => {
    win = null;
  });

  void win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // 除錯用：設定環境變數後啟動，4 秒後輸出狀態並自動結束
  //   TVWALL_SCREENSHOT=路徑.png  → 螢幕截圖
  //   TVWALL_DUMP=路徑.json       → 留下畫面狀態（來源、尺寸、錯誤訊息等）
  const shot = process.env.TVWALL_SCREENSHOT;
  const dump = process.env.TVWALL_DUMP;
  if (shot || dump) {
    win.webContents.once("did-finish-load", () => {
      /* 除錯：TVWALL_TAB=tv|honor|books → 載入後自動切到該分頁（配合截圖） */
      const tabTest = (process.env.TVWALL_TAB || "").toLowerCase();
      if (tabTest === "honor" || tabTest === "books") {
        void win?.webContents.executeJavaScript(
          `document.getElementById('tab${tabTest === "honor" ? "Honor" : "Books"}')?.click()`,
        ).catch(() => undefined);
      }
      setTimeout(() => {
        const w = win;
        if (!w) return;
        w.webContents
          .executeJavaScript(DIAG_JS)
          .then(async (state) => {
            if (dump) fs.writeFileSync(dump, JSON.stringify(state, null, 2));
            if (shot) fs.writeFileSync(shot, (await w.webContents.capturePage()).toPNG());
            app.quit();
          })
          .catch(() => app.quit());
      }, 4000);
    });
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  setupIpc();

  void app.whenReady().then(() => {
    createWindow();
    /* 伺服器模式：本機接受「tv-wall-client 上傳工具」把影片／照片／好書介紹上傳進資料夾 */
    const bootCfg = resolveConfig();
    if (bootCfg.serverMode) {
      startMediaServer({
        videoDir: bootCfg.videoDir,
        imagesDir: bootCfg.imagesDir,
        booksDir: bootCfg.booksDir,
        campusDir: bootCfg.campusDir,
        healthDir: bootCfg.healthDir,
        port: bootCfg.serverPort,
        configPath: bootCfg.configPath,
        onUploaded: () => {
          /* 上傳完成 → 立刻重掃資料夾，不需要按 r */
          if (win && !win.isDestroyed()) win.webContents.send("synced");
        },
      });
    }

    /* 監看 config.json 變更（tv-wall-client 遠端改分頁顯示／手動編輯）→ 即時通知 renderer */
    if (bootCfg.configPath) {
      let cfgNotifyTimer: NodeJS.Timeout | null = null;
      try {
        fs.watch(path.dirname(bootCfg.configPath), (_event, filename) => {
          if (!filename) return;
          try {
            if (path.join(path.dirname(bootCfg.configPath), filename) !== bootCfg.configPath) return;
          } catch {
            return;
          }
          if (cfgNotifyTimer) clearTimeout(cfgNotifyTimer);
          cfgNotifyTimer = setTimeout(() => {
            try {
              /* 讀檔失敗（可能還在寫入）就等下一次變更 */
              const raw = JSON.parse(fs.readFileSync(bootCfg.configPath, "utf8").replace(/^\uFEFF/, "")) as FileConfig;
              const tabs = {
                tv: raw.tabs ? raw.tabs.tv !== false : true,
                honor: raw.tabs ? raw.tabs.honor !== false : true,
                books: raw.tabs ? raw.tabs.books !== false : true,
                campus: raw.tabs ? raw.tabs.campus !== false : true,
                health: raw.tabs ? raw.tabs.health !== false : true,
              };
              if (win && !win.isDestroyed()) {
                win.webContents.send("config-updated", { tabs, defaultTab: raw.defaultTab === "honor" ? "honor" : "tv" });
              }
            } catch {
              /* 讀取失敗：略過 */
            }
          }, 400);
        });
      } catch (err) {
        console.warn(`[config] 無法監看 config.json 變更：${err instanceof Error ? err.message : String(err)}`);
      }
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
