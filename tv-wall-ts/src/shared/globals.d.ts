/**
 * 跨主程序／渲染程序共用的型別（全域宣告）。
 * 注意：src/renderer/renderer.ts 會以「無 import/export 的指令稿」方式編譯，
 * 因此共用型別必須放在 .d.ts 裡，不能用 import 引入。
 */

/** 一個媒體檔案 */
interface MediaItem {
  /** 可直接給 <video>/<img> 使用的 file:// 網址 */
  url: string;
  /** 檔名（含副檔名） */
  name: string;
}

/** 圖片／影片在窗格內的縮放方式 */
type FitMode = "contain" | "cover" | "fill";

/** 傳給渲染程序的設定 */
interface AppConfig {
  /** 圖片每頁停留毫秒 */
  imageIntervalMs: number;
  /** 好書介紹每頁停留毫秒 */
  bookIntervalMs: number;
  /** 校園風雲每頁停留毫秒 */
  campusIntervalMs?: number;
  /** 衛教宣導每頁停留毫秒 */
  healthIntervalMs?: number;
  /** 輔導室公告每頁停留毫秒 */
  counselingIntervalMs?: number;
  /** 校園榮譽榜每頁停留毫秒 */
  campusHonorIntervalMs?: number;
  /** 影片填滿窗格的方式 */
  videoFit: FitMode;
  /** 圖片填滿窗格的方式 */
  imageFit: FitMode;
  /** 啟動時的預設分頁："tv"（電視牆）或 "honor"（積點排行） */
  defaultTab: string;
  /** 各分頁顯示／隱藏（false＝隱藏；未填的 key 視為顯示） */
  tabs?: TabVisibility;
  /** 各分頁的顯示標題（config.json 的 tabNames 區塊；未填的 key 用預設名稱） */
  tabNames?: TabNames;
  /** 本機區網 IPv4（顯示在畫面右上角） */
  localIP?: string;
}

/** 分頁顯示控制（config.json 的 tabs 區塊） */
interface TabVisibility {
  /** 電視牆（預設 true） */
  tv?: boolean;
  /** 好書介紹（預設 true） */
  books?: boolean;
  /** 校園風雲（預設 true） */
  campus?: boolean;
  /** 衛教宣導（預設 true） */
  health?: boolean;
  /** 輔導室公告（預設 true） */
  counseling?: boolean;
  /** 校園榮譽榜（預設 true） */
  campusHonor?: boolean;
}

/** 分頁標題（config.json 的 tabNames 區塊；空白＝用預設名稱） */
interface TabNames {
  /** 精彩槺榔（預設「精彩槺榔」） */
  tv?: string;
  /** 好書介紹（預設「好書介紹」） */
  books?: string;
  /** 校園風雲（預設「校園風雲」） */
  campus?: string;
  /** 衛教宣導（預設「衛教宣導」） */
  health?: string;
  /** 輔導室公告（預設「輔導室公告」） */
  counseling?: string;
  /** 校園榮譽榜（預設「校園榮譽榜」） */
  campusHonor?: string;
}

/** 掃描結果 */
interface ScanResult {
  videos: MediaItem[];
  images: MediaItem[];
  /** 好書介紹圖片（books 資料夾） */
  books: MediaItem[];
  /** 校園風雲圖片（campus 資料夾） */
  campus: MediaItem[];
  /** 衛教宣導圖片（health 資料夾） */
  health: MediaItem[];
  /** 輔導室公告圖片（counseling 資料夾） */
  counseling: MediaItem[];
  /** 校園榮譽榜圖片（campusHonor 資料夾） */
  campusHonor: MediaItem[];
}

/** 好書介紹分頁的注入設定（renderer.ts 於 init 時設定） */
interface BookSettings {
  /** 每頁停留毫秒 */
  intervalMs: number;
}

/** preload 暴露給渲染程序的 API（window.tvwall） */
interface TvWallApi {
  scan(): Promise<ScanResult>;
  config(): Promise<AppConfig>;
  close(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  /** tv-wall-client 上傳完成／重新封包重掃時觸發（回傳解除註冊的函式） */
  onSynced(cb: () => void): () => void;
  /** config.json 更新時觸發（分頁顯示等；回傳解除註冊的函式） */
  onConfigUpdated(cb: (cfg: AppConfig) => void): () => void;
}

declare const tvwall: TvWallApi;

/** 卡片分頁模版的設定（cardTabs.js 註冊用；版面與行為由 cardTabTemplate.js 統一產生） */
interface CardTabDef {
  /** 分頁代號（＝伺服器資料夾名稱，例如 "campusHonor"） */
  key: string;
  /** 分頁圖示（emoji） */
  icon: string;
  /** 預設標題（用戶端可遠端改名） */
  name: string;
  /** 計數單位（預設「本」） */
  unit?: string;
  /** 空清單訊息（預設統一文案） */
  emptyMsg?: string;
  /** config.json 的間隔欄位名（預設 key + "IntervalMs"） */
  intervalKey?: string;
}

/** 卡片分頁模版產生的實例（cardTabTemplate.js 回傳） */
interface CardTabInstance {
  key: string;
  name: string;
  /** config.json 的間隔欄位名（renderer.ts 讀取每頁停留毫秒用） */
  intervalKey: string | null;
  /** 模版產生的分頁按鈕與頁面元素 */
  tabButton: HTMLButtonElement;
  page: HTMLElement;
  /** 分頁按鈕點擊回呼（renderer.ts 指定） */
  onSelect: (() => void) | null;
  /** 遠端更名：同時更新分頁按鈕與卡片標籤 */
  setName(name: string): void;
  /** 顯示／隱藏分頁按鈕 */
  setVisible(visible: boolean): void;
  init(settings: BookSettings): void;
  /** 掃描結果更新（含剛啟動第一次） */
  setItems(items: MediaItem[]): void;
  /** 分頁切換 */
  onShow(): void;
  onHide(): void;
  /** 分頁內鍵盤事件（Escape／F11 由 renderer 處理，其餘在此處理） */
  onKey(e: KeyboardEvent): boolean;
}

/** 卡片分頁模版（cardTabTemplate.js 提供；renderer.ts 於 init 時驅動） */
interface Window {
  createCardTab(def: CardTabDef): CardTabInstance;
  /** cardTabs.js 依註冊清單產生的分頁實例（順序＝分頁按鈕順序） */
  CARD_TAB_INSTANCES?: CardTabInstance[];
  CARD_TAB_DEFS?: CardTabDef[];
}
