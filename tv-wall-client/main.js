const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 700,
    minWidth: 700,
    minHeight: 600,
    frame: false,            // 無邊框：使用自訂 titlebar 介面
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.ico")   // 打包版：extraFiles 放到 resources/
      : path.join(__dirname, "icon.ico"),               // 開發版：專案根目錄
    title: "電視牆用戶端上傳工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  // 啟動時最大化視窗
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // 開發時可開啟 DevTools
  // mainWindow.webContents.openDevTools();
}

/**
 * 使用者設定的寫入位置：userData（不受安裝目錄權限影響，重裝／升級也不會被覆蓋）。
 * 例：C:\Users\<user>\AppData\Roaming\TvWallClient\config.json
 */
function writeConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

/**
 * 讀取設定：優先 userData，其次 exe 旁（舊版安裝留下的設定，用於一次性遷移），
 * 最後才是開發目錄。每次都重新讀取，避免快取造成第二次呼叫回傳 null
 * （舊版的 _last 會讓密碼讀取永遠失敗、退回預設密碼）。
 */
function bootConfig() {
  const candidates = [...new Set([
    writeConfigPath(),
    path.join(path.dirname(process.execPath), "config.json"),
    path.join(__dirname, "config.json"),
  ])];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const text = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
      return { path: p, raw: JSON.parse(text) };
    } catch (err) {
      console.warn(`config.json 讀取失敗（${p}）：${err.message}`);
    }
  }
  return null;
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("get-version", () => app.getVersion());

/* 移除預設功能表（File/Edit/View/Window），介面全部由自訂 GUI 呈現 */
Menu.setApplicationMenu(null);

/* 無邊框視窗控制 */
ipcMain.on("window-minimize", () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on("window-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window-close", () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle("get-boot-config", () => bootConfig());

/** 把 patch（{ servers: [...] }、{ password: "…" }）合併寫回使用者設定；只動有給的欄位 */
ipcMain.handle("save-boot-config", (_event, patch) => {
  try {
    const p = writeConfigPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let raw = {};
    try {
      if (fs.existsSync(p)) {
        raw = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
      } else {
        /* 第一次寫入：把舊版 exe 旁的設定（servers／password）遷移過來 */
        const legacy = bootConfig();
        if (legacy) raw = legacy.raw;
      }
    } catch { /* 舊檔解析失敗時整份重寫 */ }
    Object.assign(raw, patch || {});
    /* 原子寫入：先寫暫存檔再改名，避免另一支程式讀到半份 JSON */
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(raw, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, p);
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
