/**
 * 分頁顯示設定（tabs／tabNames）的唯一正規化來源。
 *
 * 主程序（resolveConfig、config.json 變更監看）與內建 HTTP 伺服器（GET／POST /config）
 * 都必須用同一套規則，否則遠端改完設定後，畫面上顯示的名稱／分頁可能和設定檔不一致。
 */

/** 六個分頁的鍵（順序固定：電視牆、好書介紹、校園風雲、衛教宣導、輔導室公告、校園榮譽榜） */
export const TAB_KEYS = [
  "tv",
  "books",
  "campus",
  "health",
  "counseling",
  "campusHonor",
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

/** 分頁是否顯示 */
export type TabVisibility = Record<TabKey, boolean>;

/** 分頁標題（空白＝使用預設值） */
export type TabNameOverrides = Partial<Record<TabKey, string>>;

/** 分頁標題長度上限 */
export const TAB_NAME_MAX_LENGTH = 20;

/** 未設定時使用的預設分頁標題 */
export const DEFAULT_TAB_NAMES: Record<TabKey, string> = {
  tv: "精彩槺榔",
  books: "好書介紹",
  campus: "校園風雲",
  health: "衛教宣導",
  counseling: "輔導室公告",
  campusHonor: "校園榮譽榜",
};

/** tabs：未填或非布林值一律視為顯示（只有明確設定 false 才隱藏） */
export function normalizeTabs(raw: unknown): TabVisibility {
  const t = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as TabVisibility;
  for (const key of TAB_KEYS) out[key] = t[key] !== false;
  return out;
}

/** tabNames：去頭尾空白、最長 20 字；空白字串略過（代表沿用預設名稱） */
export function normalizeTabNames(raw: unknown): TabNameOverrides {
  const t = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: TabNameOverrides = {};
  for (const key of TAB_KEYS) {
    const v = t[key];
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, TAB_NAME_MAX_LENGTH);
    if (s) out[key] = s;
  }
  return out;
}

/** tabNames 補上預設值（給主程序顯示用；HTTP 回傳仍保留「未設定＝省略」的原始語意） */
export function resolveTabNames(raw: unknown): Record<TabKey, string> {
  const overrides = normalizeTabNames(raw);
  const out = {} as Record<TabKey, string>;
  for (const key of TAB_KEYS) out[key] = overrides[key] ?? DEFAULT_TAB_NAMES[key];
  return out;
}
