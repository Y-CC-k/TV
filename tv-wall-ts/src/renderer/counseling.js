// ==========================================================================
// 輔導室公告分頁 — counseling 資料夾圖片卡片式輪播
// 生命週期（與 honor.js 相同模式）：
//   1) renderer.ts 取得 config 後呼叫 CounselingTab.init(settings) → 注入設定
//   2) 每次掃描完成呼叫 CounselingTab.setItems(items) → 更新清單
//   3) 分頁切換 → CounselingTab.onShow() / onHide()
//   4) 分頁內按鍵 → CounselingTab.onKey(e)（Escape／F11 由 renderer.ts 處理）
// =========================================================================+
(function () {
  "use strict";

  var els = {
    page: null, cover: null, title: null, counter: null,
    dots: null, prev: null, next: null, msg: null,
    sidebarStart: null, sidebarEnd: null
  };

  var SETTINGS = null;            // 由 CounselingTab.init() 注入
  var items = [];                 // MediaItem[]（由 renderer.ts 注入）
  var idx = 0;
  var paused = false;
  var timer = null;
  var bound = false;              // 已綁定事件

  function $(id) {
    return document.getElementById(id);
  }

  /** 綁定 DOM 與事件（第一次需要時執行） */
  function bindDom() {
    if (bound) return;
    bound = true;
    els.page = $("counselingPage");
    els.cover = $("counselingCover");
    els.title = $("counselingTitle");
    els.counter = $("counselingCounter");
    els.dots = $("counselingDots");
    els.prev = $("counselingPrev");
    els.next = $("counselingNext");
    els.msg = $("counselingMsg");
    els.sidebarStart = $("counselingSidebarStart");
    els.sidebarEnd = $("counselingSidebarEnd");

    els.prev.addEventListener("click", function () { manualStep(-1); });
    els.next.addEventListener("click", function () { manualStep(1); });
    els.dots.addEventListener("click", function (e) {
      var tgt = e.target;
      if (!tgt || !tgt.classList || !tgt.classList.contains("book-dot")) return;
      var i = parseInt(tgt.getAttribute("data-idx"), 10);
      if (isNaN(i)) return;
      idx = i;
      show();
      startTimer();
    });
    // 點卡片＝暫停／繼續（同 Space）
    els.cover.addEventListener("click", function () { togglePause(); });
  }

  /** 由檔名取書名：去副檔名、去開頭編號（「01_小王子.png」→「小王子」） */
  function titleFromName(name) {
    var t = String(name || "").replace(/\.[^.]+$/, "");
    t = t.replace(/^\d+[\s._-]*/, "");
    return t.trim() || String(name || "").replace(/\.[^.]+$/, "");
  }

  function setMsg(text) {
    if (!els.msg) return;
    if (text == null) {
      els.msg.textContent = "";
      els.msg.classList.add("hidden");
    } else {
      els.msg.textContent = text;
      els.msg.classList.remove("hidden");
    }
  }

  /** 渲染目前這一本 */
  function show() {
    if (!bound) return;
    if (items.length === 0) {
      /* 空清單：隱藏整個卡片舞台，只顯示訊息 */
      if (els.page) els.page.classList.add("books-empty");
      els.cover.classList.add("hidden");
      els.cover.removeAttribute("src");
      els.title.textContent = "";
      els.counter.textContent = "";
      renderDots();
      setMsg("counseling 資料夾沒有輔導室公告圖片，請用「電視牆用戶端上傳工具」上傳");
      return;
    }
    if (els.page) els.page.classList.remove("books-empty");
    if (idx >= items.length) idx = 0;
    var item = items[idx];
    setMsg(null);
    els.cover.classList.remove("hidden");
    els.cover.src = item.url;
    els.title.textContent = titleFromName(item.name);
    els.counter.textContent = paused ? "⏸ 暫停" : "第 " + (idx + 1) + " 本／共 " + items.length + " 本";
    renderDots();
    renderSidebar();
  }

  function renderDots() {
    if (!bound || !els.dots) return;
    var html = "";
    for (var i = 0; i < items.length; i++) {
      html += '<button type="button" class="book-dot' + (i === idx && items.length > 1 ? " active" : "") +
        '" data-idx="' + i + '" aria-label="第 ' + (i + 1) + ' 本"></button>';
    }
    els.dots.innerHTML = html;
  }

  var sidebarList = [];           // 目前的側邊小卡清單（隨機 8 張）

  /** 側邊小卡：隨機挑選 8 張（不足 8 張時循環重複補滿；洗牌只在清單更新或進入分頁時重抽） */
  function refreshSidebarList() {
    if (items.length === 0) { sidebarList = []; return; }
    var pool = items.map(function (it, i) { return { item: it, idx: i }; });
    /* Fisher–Yates 洗牌 */
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var base = pool.slice(0, Math.min(8, pool.length));
    var out = [];
    while (out.length < 8 && base.length > 0) {
      var e = base[out.length % base.length];
      out.push({ item: e.item, idx: e.idx });
    }
    sidebarList = out;
  }

  function renderSidebar() {
    if (!bound) return;
    var six = sidebarList;
    var left = six.slice(0, 4);
    var right = six.slice(4, 8);
    [ { root: els.sidebarStart, list: left }, { root: els.sidebarEnd, list: right } ].forEach(function (g) {
      if (!g.root) return;
      g.root.innerHTML = "";
      g.list.forEach(function (entry) {
        var card = document.createElement("div");
        card.className = "book-sidebar-item" + (entry.idx === idx ? " active" : "");
        card.title = titleFromName(entry.item.name);
        var img = document.createElement("img");
        img.src = entry.item.url;
        img.alt = titleFromName(entry.item.name);
        var name = document.createElement("span");
        name.textContent = titleFromName(entry.item.name);
        card.appendChild(img);
        card.appendChild(name);
        card.addEventListener("click", function () {
          idx = entry.idx;
          show();
          renderSidebar();
          startTimer();
        });
        g.root.appendChild(card);
      });
    });
  }

  function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (paused || items.length <= 1) return;
    var ms = SETTINGS && SETTINGS.intervalMs ? SETTINGS.intervalMs : 8000;
    timer = setTimeout(function () {
      idx = (idx + 1) % items.length;
      show();
      startTimer();
    }, ms);
  }

  function next() { if (items.length) { idx = (idx + 1) % items.length; show(); } }
  function prev() { if (items.length) { idx = (idx - 1 + items.length) % items.length; show(); } }

  /** 手動翻頁（按鈕或方向鍵）→ 重啟計時器 */
  function manualStep(step) {
    if (step === 1) next(); else prev();
    startTimer();
  }

  function togglePause() {
    paused = !paused;
    if (paused) stopTimer(); else startTimer();
    show(); // 讓 counter 顯示暫停狀態
  }

  // ---- 對 renderer.ts 的介面 --------------------------------------------

  window.CounselingTab = {
    /** 注入設定（renderer.ts 取得 config 後呼叫） */
    init: function (settings) {
      SETTINGS = settings;
      bindDom();
      show();
    },

    /** 掃描結果更新（books 清單有變動時也會被呼叫） */
    setItems: function (newItems) {
      bindDom();
      items = Array.isArray(newItems) ? newItems : [];
      if (idx >= items.length) idx = 0;
      refreshSidebarList();
      show();
      if (els.page && !els.page.classList.contains("hidden")) startTimer();
    },

    /** 分頁切換到「輔導室公告」 */
    onShow: function () {
      bindDom();
      refreshSidebarList();
      show();
      startTimer();
    },

    /** 離開「輔導室公告」分頁 */
    onHide: function () {
      stopTimer();
    },

    /** 分頁內鍵盤事件（renderer.ts 把 Escape／F11 以外的鍵送過來） */
    onKey: function (e) {
      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          e.stopPropagation();
          togglePause();
          return true;
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          manualStep(1);
          return true;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          manualStep(-1);
          return true;
        default:
          return false;
      }
    }
  };
})();
