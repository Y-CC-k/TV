// ==========================================================================
// 積點排行分頁 — 資料邏輯（移植自 honor-system：vanilla JS + Supabase RPC）
// 生命週期：
//   1) DOMContentLoaded → 綁定 DOM 與查詢事件（不做資料請求）
//   2) renderer.ts 取得 config.json 後呼叫 HonorTab.init(settings) → 第一次載入
//   3) 分頁切換 → HonorTab.onShow() / onHide()
// =========================================================================+
(function () {
  "use strict";

  var HONOR_REFRESH_MS = 18e5; // 每 30 分鐘重新抓取排行榜

  var SETTINGS = null; // 由 renderer.ts 透過 HonorTab.init() 注入

  var els = {
    page: null, scoring: null,
    name: null, id: null,
    queryInput: null, queryBtn: null,
    rankBtnTotal: null, rankBtnMonthly: null
  };
  var docBound = false; // DCL 已執行
  var initialized = false; // HonorTab.init 已執行
  var refreshTimer = null;
  var gMode = "total";   // "total" | "monthly"
  var gLoaded = null;    // 各項目排行資料 { name, rows[] } | null（載入中）

  // 排行面板項目（對應 school_stu_points 欄位）
  var ITEMS = [
    { name: "英文", item: "readBook" },
    { name: "閱讀", item: "read" },
    { name: "跑步", item: "run" },
    { name: "榮譽", item: "honor" }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Supabase RPC ------------------------------------------------------
  function sbRPC(fn, body) {
    return fetch(SETTINGS.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        "apikey": SETTINGS.publishableKey,
        "Authorization": "Bearer " + SETTINGS.publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        throw new Error("supabase " + r.status + " " + t.slice(0, 200));
      });
      return r.json();
    });
  }

  // ---- 數字計數動畫 --------------------------------------------------------
  function countTo(el, target) {
    var start = parseInt(el.textContent, 10) || 0;
    target = parseInt(target, 10) || 0;
    if (start === target) { el.textContent = target; return; }
    var diff = target - start;
    var duration = 900;
    var startTime = performance.now();
    function step(now) {
      var t = Math.min(1, (now - startTime) / duration);
      var ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.floor(start + diff * ease);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  function showStudent(d) {
    var sp = (d && d.student) || {};
    var rec = (d && d.stu_points) || {};
    els.name.textContent = sp.stu_name || "　";
    els.id.textContent = sp.stu_id || "---";
    var slots = { A: "readBook", B: "read", C: "run", D: "honor" };
    ["A", "B", "C", "D"].forEach(function (k) {
      countTo(document.getElementById("score" + k).querySelector(".score-value"), rec[slots[k]]);
    });
  }

  function clearStudent() {
    els.name.textContent = "　";
    els.id.textContent = "---";
    ["A", "B", "C", "D"].forEach(function (k) {
      document.getElementById("score" + k).querySelector(".score-value").textContent = "0";
    });
  }

  function toast(msg) {
    var t = document.getElementById("honorToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    window.setTimeout(function () { t.classList.remove("show"); }, 3000);
  }

  // ---- 查詢 --------------------------------------------------------------
  function handleCard(cardId) {
    if (!cardId || !SETTINGS) return;
    sbRPC("get_stu_points", { p_card: cardId })
      .then(function (d) {
        // PostgREST 對 RETURNS TABLE 的函數回傳陣列，取出第一筆
        if (Array.isArray(d)) d = d[0] || null;
        if (d && d.student) showStudent(d);
        else { toast("查無此卡號/學號"); clearStudent(); }
      })
      .catch(function (err) { toast("查詢失敗：" + String(err && err.message || err).slice(0, 50)); });
  }

  // ---- 排行榜渲染 ----------------------------------------------------------
  function renderPanels(loaded) {
    if (loaded !== undefined) gLoaded = loaded;
    var root = els.scoring;
    if (!root) return;
    root.innerHTML = "";
    ITEMS.forEach(function (col, idx) {
      var rows = gLoaded ? ((gLoaded[idx] && gLoaded[idx].rows) || []) : [];
      var panel = document.createElement("div");
      panel.className = "panel";
      var head = document.createElement("div");
      head.className = "head";
      head.innerHTML = '<div class="panel-title">' + esc(col.name) + '</div>';
      panel.appendChild(head);

      var wrap = document.createElement("div");
      wrap.className = "rank-list-wrap";
      if (!gLoaded) wrap.innerHTML = '<div class="load-hint">載入中…</div>';
      else if (rows.length === 0) wrap.innerHTML = '<div class="load-hint">此項目目前沒有排名資料</div>';
      rows.forEach(function (s, i) {
        var rank = i + 1;
        var row = document.createElement("div");
        row.className = "ranking rank-" + rank;
        var medal;
        if (rank <= 3) medal = '<div class="medal top3">🏆</div>';
        else if (rank <= 6) medal = '<div class="medal top46">🏅</div>';
        else medal = '<div class="medal normal">' + rank + "</div>";
        row.innerHTML =
          '<div class="rank-badge">' + medal + '</div>' +
          '<div class="who">' +
            '<p class="ranking_name">' + esc(s.stu_name) + "</p>" +
            '<p class="ranking_id_num">' + esc(s.stu_id) + "</p>" +
          "</div>" +
          '<div class="num"><span class="point">' + esc(s.point) + "</span></div>";
        wrap.appendChild(row);
      });
      panel.appendChild(wrap);
      var foot = document.createElement("div");
      foot.className = "foot";
      panel.appendChild(foot);
      root.appendChild(panel);
    });
  }

  // ---- 資料載入 ----------------------------------------------------------
  function getInitialData() {
    if (!initialized || !SETTINGS) return;
    var fn = gMode === "monthly" ? "get_monthly_ranking" : "get_total_ranking";
    Promise.all(ITEMS.map(function (col) {
      return sbRPC(fn, { p_item: col.item, p_limit: 10 }).then(function (rows) {
        var arr = Array.isArray(rows) ? rows : (rows || []);
        return {
          rows: arr.map(function (r) {
            return {
              stu_name: r.name,
              stu_id: r.card,
              point: (r.points == null ? 0 : r.points)
            };
          })
        };
      }).catch(function () {
        return { rows: [] }; // 單一項目失敗不阻斷其他面板
      });
    })).then(function (list) {
      gLoaded = list;
      renderPanels(gLoaded);
      toast((gMode === "monthly" ? "月排行" : "總排行") + "資料來源：Supabase");
    }).catch(function (err) {
      toast("排行榜連線失敗：" + String(err && err.message || err).slice(0, 60));
      renderPanels([]);
    });
  }

  function setRankMode(mode) {
    gMode = mode;
    if (els.rankBtnTotal && els.rankBtnMonthly) {
      els.rankBtnTotal.classList.toggle("active", mode === "total");
      els.rankBtnMonthly.classList.toggle("active", mode === "monthly");
    }
    getInitialData();
  }

  function bindDom() {
    els.scoring = document.getElementById("scoring");
    els.name = document.getElementById("stuName");
    els.id = document.getElementById("stuId");
    els.queryInput = document.getElementById("queryInput");
    els.queryBtn = document.getElementById("queryBtn");
    els.rankBtnTotal = document.getElementById("rankBtnTotal");
    els.rankBtnMonthly = document.getElementById("rankBtnMonthly");

    if (els.rankBtnTotal && els.rankBtnMonthly) {
      els.rankBtnTotal.addEventListener("click", function () { setRankMode("total"); });
      els.rankBtnMonthly.addEventListener("click", function () { setRankMode("monthly"); });
    }

    els.queryBtn.addEventListener("click", function () {
      handleCard(els.queryInput.value.trim());
      els.queryInput.value = "";
      els.queryInput.focus();
    });
    els.queryInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCard(els.queryInput.value.trim());
        els.queryInput.value = "";
      }
    });

    // 數字鍵盤：點選輸入卡號
    var numpad = document.getElementById("numpad");
    if (numpad) {
      numpad.addEventListener("click", function (e) {
        var btn = e.target.closest(".np-btn");
        if (!btn) return;
        var key = btn.getAttribute("data-key");
        if (key === "C") {
          // 清除：清空輸入框
          els.queryInput.value = "";
        } else if (key === "E") {
          // 確認：查詢
          handleCard(els.queryInput.value.trim());
          els.queryInput.value = "";
        } else {
          // 數字：附加到輸入框（上限 12 碼）
          if (els.queryInput.value.length < 12) {
            els.queryInput.value += key;
          }
        }
        els.queryInput.focus({ preventScroll: true });
      });
    }

    // DOM 已就緒，載入排行榜資料
    renderPanels(gLoaded);
    getInitialData();
  }

  window.HonorTab = {
    /** renderer.ts 在取得 config.json 後呼叫（settings 來自 honor 區塊） */
    init: function (settings) {
      SETTINGS = settings;
      initialized = true;
      if (!SETTINGS || !SETTINGS.supabaseUrl || !SETTINGS.publishableKey) {
        renderPanels(null);
        toast("請於 config.json 設定 honor 區塊（supabaseUrl / publishableKey）");
        return;
      }
      renderPanels(null); // 開機即鋪出四個空白面板
      getInitialData();
    },
    onShow: function () {
      if (els.queryInput) els.queryInput.focus();
      renderPanels(gLoaded || null);
      getInitialData();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = window.setInterval(getInitialData, HONOR_REFRESH_MS);
    },
    onHide: function () {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (docBound) return;
    docBound = true;
    bindDom();
  });
  // 頁面若已載入完成（DCL 已過），直接綁定 DOM
  if (document.readyState === "complete" || document.readyState === "interactive") {
    if (!docBound) { docBound = true; bindDom(); }
  }
})();
