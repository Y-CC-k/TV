// ==========================================================================
// 卡片分頁註冊清單（模版設定檔）
// --------------------------------------------------------------------------
// ★ 新增分頁：在下面的清單加一項即可，版面／輪播／鍵盤全部由模版自動產生。
//   key：分頁代號（＝伺服器資料夾名稱，需與 mediaserver.ts 的 dirForKind 對應）
//   icon：分頁圖示　name：預設標題（用戶端可遠端改名）
//   intervalKey：config.json 的每頁停留毫秒欄位（未填＝key + "IntervalMs"）
//
// 順序＝分頁按鈕順序（排在「分頁一：電視牆」之後）。
// ==========================================================================
(function () {
  "use strict";

  var CARD_TAB_DEFS = [
    { key: "books",       icon: "📚", name: "好書介紹",   intervalKey: "bookIntervalMs" },
    { key: "campus",      icon: "📰", name: "校園風雲",   intervalKey: "campusIntervalMs" },
    { key: "health",      icon: "🏥", name: "衛教宣導",   intervalKey: "healthIntervalMs" },
    { key: "counseling",  icon: "🧠", name: "輔導室公告", intervalKey: "counselingIntervalMs" },
    { key: "campusHonor", icon: "🏆", name: "校園榮譽榜", intervalKey: "campusHonorIntervalMs" }
  ];

  window.CARD_TAB_DEFS = CARD_TAB_DEFS;
  window.CARD_TAB_INSTANCES = CARD_TAB_DEFS.map(function (def) {
    return window.createCardTab(def);
  });
})();
