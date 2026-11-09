/**
 * 媒體副檔名定義（主程序掃描與內建伺服器共用）。
 * （原放在 sync.ts；已移除伺服器同步機制後保留此共用定義。）
 */

/** 支援的影片副檔名（與瀏覽器支援度無關，全部列入掃描；不支援的會顯示「無法播放」） */
export const VIDEO_EXTS = new Set([".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"]);
/** 支援的圖片副檔名（含好書介紹 books） */
export const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".bmp", ".webp"]);
