# 電視牆公告系統（TypeScript + Electron）

三個分頁的公告機播放器：

| 分頁 | 內容 | 資料來源 |
| --- | --- | --- |
| 📺 電視牆 | 上（左）層循環播放影片、下（右）層圖片輪播 | `video`／`images` 資料夾 |
| 🏆 積點排行 | 榮譽系統排行榜 ＋ 卡號／學號查詢 | Supabase（config.json 的 `honor` 區塊） |
| 📚 好書介紹 | 書籍介紹卡片輪播（封面圖＋書名，由檔名來出） | `books` 資料夾 |

- 直立螢幕＝上下各半，橫向螢幕＝左右各半（依視窗比例自動切換）
- 啟動後直接全螢幕、黑底、無選單列
- 三個分頁每分鐘自動輪換（點選分頁列也可手動切換）

**資料來源**：公告機的 `video`／`images`／`books` 資料夾，由
**「電視牆用戶端上傳工具」（專案 tv-wall-client）** 打包上傳，上傳完成後本程式
立刻重掃並加入播放輪替。**沒有任何「伺服器↔用戶端」同步機制**——每台公告機
都是獨立的，把資料上傳進資料夾即可（也可直接用檔案總管複製檔案進資料夾後按 `r`）。

## 分頁：★★ 積點排行（榮譽系統）

`config.json` 加上 `honor` 區塊即啟用（沒有此區塊時只顯示電視牆與好書介紹）：

```json
{
  "defaultTab": "tv",
  "honor": {
    "supabaseUrl": "https://xxxx.supabase.co",
    "publishableKey": "sb_publishable_…",
    "schoolId": "283b80a6-…（學校 UUID）",
    "topN": 10
  }
}
```

- 排行榜 4 個面板（英文／閱讀／跑步／榮譽）由左至右平分、無間隙
- 卡號／學號查詢走 RPC `get_stu_points`；每 30 分鐘自動刷新排行榜
- 電視牆熱鍵（Space／方向鍵／r／Esc）在積點排行分頁不會作用，避免干擾查詢

## 分頁：★★ 好書介紹

- 卡片式版面：一次顯示一本書（封面圖＋書名），左右按鈕或方向鍵翻頁、底部圓點直接跳頁
- **書名由檔名來出**：`01_小王子.jpg` → 顯示「小王子」（去副檔名、去開頭編號）
- 每頁停留 `bookIntervalMs` 毫秒（預設 8 秒）自動換下一本；`Space` 暫停／繼續
- 內容來源：`books` 資料夾裡的圖片（由上傳工具的「📚 好書介紹」分頁上傳）

## 環境需求

- Node.js 18 以上（開發時用）
- 首次執行 `npm install` 會下載 Electron 執行檔

## 執行

```powershell
cd D:\tv-wall-ts
npm install      # 第一次
npm run dev      # 編譯（tsc ＋ 複製 HTML/CSS）並啟動
```

其他指令：

```powershell
npm run build      # 只編譯到 dist\
npm run typecheck  # 只做型別檢查
npm start          # 直接執行（需先 build）
npm run dist       # 打包免安裝執行檔（見下方「打包」）
```

## 熱鍵

| 按鍵 | 📺 電視牆 | 📚 好書介紹 |
| --- | --- | --- |
| `Esc` 或滑鼠雙擊 | 關閉 | 關閉 |
| `F11` | 全螢幕切換 | 全螢幕切換 |
| `Space` | 暫停／繼續（影片＋圖片輪播） | 暫停／繼續（書籍輪播） |
| `→` `↓` | 圖片下一張 | 下一本 |
| `←` `↑` | 圖片上一張 | 上一本 |
| `r` | 重新掃描資料夾 | 重新掃描資料夾 |

（🏆 積點排行分頁按鍵留給查詢輸入框，不作用。）

## 設定（config.json）

放在專案根目錄，全部選填；沒有設定檔時使用預設值：

```json
{
  "videoDir": "video",
  "imagesDir": "images",
  "booksDir": "books",
  "imageIntervalMs": 5000,
  "bookIntervalMs": 8000,
  "videoFit": "contain",
  "imageFit": "fill",
  "defaultTab": "tv",
  "serverMode": false,
  "serverPort": 8123
}
```

| 欄位 | 說明 | 預設值 |
| --- | --- | --- |
| `videoDir` | 影片資料夾 | `video`（自動建立於程式資料夾） |
| `imagesDir` | 圖片資料夾 | `images`（自動建立） |
| `booksDir` | 好書介紹圖片資料夾 | `books`（自動建立） |
| `imageIntervalMs` | 圖片每頁停留毫秒 | `5000` |
| `bookIntervalMs` | 好書介紹每頁停留毫秒 | `8000` |
| `videoFit` | 影片縮放：`contain` 不變形留黑邊／`cover` 填滿裁切／`fill` 拉滿變形 | `contain` |
| `imageFit` | 圖片縮放（同上三值） | `fill` |
| `serverMode` | 本機是否開啟「上傳服務」，讓 tv-wall-client 上傳進來 | `false` |
| `serverPort` | 上傳服務連接埠 | `8123` |
| `defaultTab` | 啟動分頁：`tv` 或 `honor` | `tv` |

## 公告機（上傳服務）＋ 上傳工具

架購：**每台公告機獨立運作，內容由「電視牆用戶端上傳工具」（tv-wall-client）上傳**，
沒有機器之間的同步。

1. 公告機（本程式）的 `config.json` 設 `"serverMode": true`（打包版已附
   `config-伺服機版.json`，改名成 `config.json` 即可）
2. 上傳工具選公告機 IP，上傳：
   - 📺 電視牆分頁：照片／影片 → 進 `images`／`video` 資料夾
   - 📚 好書介紹分頁：圖片＋書名 → 進 `books` 資料夾（書名寫進檔名）
   - 表列可檢視／刪除已上傳內容
3. 上傳完成 → 公告機畫面立即重掃，影片／照片／書本立刻加入輪替

也可以直接把檔案放進資料夾，按 `r` 重掃即可。

## 專案結構

```
D:\tv-wall-ts\
├─ package.json              scripts ＋ electron-builder 打包設定（build）
├─ tsconfig.json
├─ images.jpg                程式圖示來源檔（可隨時更換）
├─ config.json               開發時的設定
├─ config.portable.json      打包用設定（複製成成品內的 config.json）
├─ config.server.json        伺服機版設定（隨封包改名 config-伺服機版.json）
├─ scripts\make-icon.mjs     由 images.jpg 產生 build\icon.ico
├─ scripts\name-exe.js       打包後把執行檔改名 TvWall-版本-日期時間.exe
├─ scripts\copy-static.js    把 HTML/CSS/JS 複製到 dist
├─ build\icon.ico            Windows 圖示（electron-builder 使用）
├─ server\server.js          （備用）純 Node 檔案伺服器，供進階需求
├─ src\
│  ├─ main\main.ts           Electron 主程序：視窗、掃描資料夾、IPC
│  ├─ main\mediaserver.ts    內建上傳服務（/upload、/files、刪除）
│  ├─ main\media.ts          影片／圖片副檔名定義
│  ├─ main\preload.ts        contextBridge，暴露 window.tvwall
│  ├─ renderer\renderer.ts   分頁切換／影片循環／圖片輪播／熱鍵
│  ├─ renderer\books.js      好書介紹分頁（卡片輪播）
│  ├─ renderer\honor.js      積點排行分頁（Supabase）
│  ├─ renderer\*.css         各分頁樣式
│  └─ shared\globals.d.ts    共用型別
├─ dist\                     編譯輸出（npm run build 產生）
└─ release\win-unpacked\     打包成品（npm run dist 產生）
```

## 與原 Python 版的差異

1. **播放核心**：python-vlc → Chromium 內建 `<video>`。
   - 支援：`mp4 / webm`；不支援 `avi / mkv / wmv / flv / mov`（顯示「無法播放」後自動跳下一部）。
2. **圖片縮放**：CSS `object-fit`（預設 `fill`，可設 `contain`／`cover`）。
3. **安全性**：主程序與渲染程序隔離（`contextIsolation`），渲染程序只能透過
   `window.tvwall` 呼叫白名單化的 IPC。

## 程式圖示

以專案根目錄的 `images.jpg` 當程式圖示：`npm run build` 自動產生 `build\icon.ico`。
更換圖示只要覆蓋 `images.jpg` 再執行一次 `npm run dist`（執行檔名含日期時間可繞過圖示快取）。

## 開機自動執行

專案內附 `install-autorun.bat`（註冊開機啟動，`remove` 解除）與 `start-tvwall.vbs`
（隱藏式啟動器，自動抓資料夾內最新的 `TvWall-*.exe`）。兩者已隨封包放進 `win-unpacked\`。

## 打包成免安裝執行檔（移機用）

```powershell
cd D:\tv-wall-ts
npm run dist
```

產出：`release\win-unpacked\`（入口 `TvWall-<版本>-<日期時間>.exe`，約 322 MB，
`config.portable.json` 已複製成資料夾內的 `config.json`）＋ NSIS 安裝檔
`release\TvWall-Setup-<版本>-<日期時間>.exe`（約 99 MB，安裝到
`%LocalAppData%\Programs\電視牆播放器`）。

### 移機步驟

1. 把整個 `release\win-unpacked\` 壓縮（zip）拷到目標機器並解壓
2. 把 `config-伺服機版.json` 改名成 `config.json`（公告機要開上傳服務）
3. 執行 `TvWall-<版本>-<日期時間>.exe`（免安裝；素材由「電視牆用戶端上傳工具」上傳）
4. 在另一台電腦安裝／執行 tv-wall-client 上傳工具

### 注意

- 目標機器需為 **Windows x64**（Windows 10/11 皆可）
- 程式未簽章：首次執行 SmartScreen 可能警告，選「仍要執行」
- 重新打包前不用手動清 `release\`，electron-builder 會覆寫

---

啟動時設定環境變數可輸出除錯資訊（4 秒後自動截圖並結束）：

```powershell
$env:TVWALL_DUMP='D:\tv-wall-ts\state.json'       # 畫面狀態（來源、尺寸、錯誤）
$env:TVWALL_SCREENSHOT='D:\tv-wall-ts\shot.png'   # 螢幕截圖
$env:TVWALL_TAB='books'                           # （選）啟動後自動切分頁 tv|honor|books
npm start
```
