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
 * 讀取 exe 旁邊的 config.json（打包版＝win-unpacked 目錄；開發版＝專案根目錄）。
 * 沒有檔案或格式錯誤時回 null，程式照樣能用（照舊用 localStorage 的設定）。
 */
function bootConfig() {
  const candidates = [
    path.join(path.dirname(process.execPath), "config.json"),
    path.join(__dirname, "config.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      // 兩個候選指向同一個檔案時只讀一次
      if (p === bootConfig._last) break;
      bootConfig._last = p;
      return { path: p, raw: JSON.parse(fs.readFileSync(p, "utf8")) };
    } catch (err) {
      console.warn(`config.json 讀取失敗（${p}）：${err.message}`);
    }
  }
  return null;
}

app.whenReady().then(createWindow);

/** 寫入目標：打包版＝exe 旁邊；開發版＝專案根目錄（main.js 旁邊） */
function writeConfigPath() {
  return app.isPackaged
    ? path.join(path.dirname(process.execPath), "config.json")
    : path.join(__dirname, "config.json");
}

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

/** 把 patch（{ servers: [...] } 或 { honor: {...} }）合併寫回 config.json；只動有給的欄位，其他保留 */
ipcMain.handle("save-boot-config", (_event, patch) => {
  try {
    const p = writeConfigPath();
    let raw = {};
    try {
      if (fs.existsSync(p)) raw = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch { /* 舊檔解析失敗時整份重寫 */ }
    Object.assign(raw, patch || {});
    fs.writeFileSync(p, JSON.stringify(raw, null, 2) + "\n", "utf8");
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
