# 電視牆系統（TV Wall）

本 repo 包含兩個 Electron 專案：

| 資料夾 | 說明 |
|--------|------|
| `tv-wall-client` | 輔助上傳工具（管理公告機、上傳照片／影片／好書介紹、積點加點） |
| `tv-wall-ts` | 公告機播放器（電視牆／好書介紹／積點排行，內建媒體伺服器） |

---

## 1. 環境需求

- **作業系統**：Windows 10 / 11（封包目標為 Windows）
- **Node.js**：18 以上（建議 LTS）— https://nodejs.org
- **npm**：隨 Node.js 附帶
- **（可選）Git**：用於 clone repo

> 封包（`npm run build` / `npm run dist`）只能在 Windows 執行，或使用 Windows 型 CI。

---

## 2. 取得原始碼

```bash
git clone https://github.com/Y-CC-k/TV.git
cd TV
```

---

## 3. 安裝相依套件

兩個專案各自有 `node_modules`，需分別安裝：

```bash
cd tv-wall-client
npm install
cd ..\tv-wall-ts
npm install
```

---

## 4. 封包 tv-wall-client（上傳工具）

```bash
cd tv-wall-client
npm run build
```

產出：
- 安裝檔：`dist\TvWallClient Setup 1.0.0.exe`
- 解開版：`dist\win-unpacked\TvWallClient.exe`

> 圖示 `icon.ico` 會在打包時由 `scripts/afterpack.js` 自動寫入 exe。
> 啟動密碼初始為 `26562684`（寫在 `config.json` 的 `password` 欄位），可在「全部設置 → 開啟密碼」更改。

---

## 5. 封包 tv-wall-ts（公告機播放器）

```bash
cd tv-wall-ts
npm run build   # TypeScript 編譯
npm run dist    # 封包 NSIS 安裝程式
```

產出：
- 安裝檔：`release\TvWall-Setup-1.0.0.exe`
- 解開版：`release\win-unpacked\TvWall-1.0.0-*.exe`

`config.portable.json` 會在打包時自動複製為 `config.json`。

---

## 6. 設定公告機（config.json）

`tv-wall-ts` 的 `config.json` 主要欄位：

```json
{
  "serverMode": true,
  "serverPort": 8123,
  "videoDir": "video",
  "imagesDir": "images",
  "booksDir": "books",
  "imageIntervalMs": 5000,
  "bookIntervalMs": 8000,
  "videoFit": "contain",
  "imageFit": "fill",
  "defaultTab": "tv",
  "tabs": { "tv": true, "honor": true, "books": true },
  "honor": {
    "supabaseUrl": "https://xxxx.supabase.co",
    "publishableKey": "sb_publishable_...",
    "topN": 10
  }
}
```

- `serverMode: true` → 啟動內建 HTTP 伺服器，供 `tv-wall-client` 上傳檔案
- `tabs` → 控制各分頁是否顯示（`false` 隱藏）
- `honor` → 積點排行連線 Supabase，未設定時該分頁自動隱藏

---

## 7. 常用操作

- 電視牆播放器：按 `r` 重新掃描資料夾、按 `Esc` 切換全螢幕
- `tv-wall-client`：先在「全部設置」加入公告機 IP/Port，再於「電視牆」分頁上傳照片／影片／好書介紹
- 分頁顯示設定：在「全部設置 → 分頁顯示設定」勾選後按「套用到公告機」，公告機播放器會即時更新

---

## 8. 重新產生圖示（選用）

若要更換 `tv-wall-client` 的軟體圖示，覆蓋 `icon.png` 後執行：

```bash
cd tv-wall-ts
node scripts/make-client-icon.mjs   # 會重產 D:\tv-wall-client\icon.ico
cd ..\tv-wall-client
npm run build
```

---

## 9. 常見問題

- `npm warn Unknown project config "electron_mirror"`：只是警告，不影響建置
- 封包失敗 `winCodeSign` symlink EPERM：本 repo 已設定 `signAndEditExecutable: false`，不需處理
- `config.json` 讀取失敗：檢查 exe 旁邊是否存在 `config.json`，或查看 `tvwall-config-debug.log`
