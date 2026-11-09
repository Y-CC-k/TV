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

/** 積點排行（榮譽系統）設定：來自 config.json 的 honor 區塊 */
interface HonorSettings {
  /** Supabase 專案網址，例：https://xxxx.supabase.co */
  supabaseUrl: string;
  /** anon / publishable key（公開讀取） */
  publishableKey: string;
  /** 預設 school_id */
  schoolId: string;
  /** 排行榜顯示筆數（預設 10） */
  topN?: number;
}

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
  /** 影片填滿窗格的方式 */
  videoFit: FitMode;
  /** 圖片填滿窗格的方式 */
  imageFit: FitMode;
  /** 啟動時的預設分頁："tv"（電視牆）或 "honor"（積點排行） */
  defaultTab: string;
  /** 各分頁顯示／隱藏（false＝隱藏；未填的 key 視為顯示） */
  tabs?: TabVisibility;
  /** 積點排行設定（有設定時才顯示該分頁） */
  honor?: HonorSettings;
  /** 本機區網 IPv4（顯示在畫面右上角） */
  localIP?: string;
}

/** 分頁顯示控制（config.json 的 tabs 區塊） */
interface TabVisibility {
  /** 電視牆（預設 true） */
  tv?: boolean;
  /** 榮譽榜／積點查詢（預設 true） */
  honor?: boolean;
  /** 好書介紹（預設 true） */
  books?: boolean;
  /** 校園風雲（預設 true） */
  campus?: boolean;
  /** 衛教宣導（預設 true） */
  health?: boolean;
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

/** 積點排行與好書介紹設定（renderer.ts 於 init 時注入） */
interface Window {
  HONOR_SETTINGS?: HonorSettings;
  HonorTab?: {
    init(settings: HonorSettings): void;
    onShow(): void;
    onHide(): void;
  };
  BOOK_SETTINGS?: BookSettings;
  BooksTab?: {
    init(settings: BookSettings): void;
    /** 掃描結果更新（含剛啟動第一次） */
    setItems(items: MediaItem[]): void;
    /** 分頁切換 */
    onShow(): void;
    onHide(): void;
    /** 分頁內鍵盤事件（Escape／F11 由 renderer 處理，其餘在此處理） */
    onKey(e: KeyboardEvent): boolean;
  };
  CAMPUS_SETTINGS?: BookSettings;
  CampusTab?: {
    init(settings: BookSettings): void;
    /** 掃描結果更新（含剛啟動第一次） */
    setItems(items: MediaItem[]): void;
    /** 分頁切換 */
    onShow(): void;
    onHide(): void;
    /** 分頁內鍵盤事件（Escape／F11 由 renderer 處理，其餘在此處理） */
    onKey(e: KeyboardEvent): boolean;
  };
  HEALTH_SETTINGS?: BookSettings;
  HealthTab?: {
    init(settings: BookSettings): void;
    /** 掃描結果更新（含剛啟動第一次） */
    setItems(items: MediaItem[]): void;
    /** 分頁切換 */
    onShow(): void;
    onHide(): void;
    /** 分頁內鍵盤事件（Escape／F11 由 renderer 處理，其餘在此處理） */
    onKey(e: KeyboardEvent): boolean;
  };
  __honorTimer?: number | null;
}
