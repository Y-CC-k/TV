// ==========================================================================
// 卡片分頁模版（統一造型工廠）
// --------------------------------------------------------------------------
// 用途：所有「圖片卡片式輪播」分頁（好書介紹／校園風雲／衛教宣導／輔導室公告／
//       校園榮譽榜…）共用同一個模版。分頁按鈕與整頁版面（側邊小卡、主卡片、
//       圓點、翻頁鈕、空清單訊息）全部由模版自動產生。
//
// 新增分頁的方式：在 cardTabs.js 的清單加一行設定即可，不需要再寫新的 JS／HTML。
//
// 設定欄位（def）：
//   key        必填  分頁代號（＝伺服器資料夾名稱，例如 "campusHonor"）
//   icon       必填  分頁圖示（emoji，例如 "🏆"）
//   name       必填  預設標題（用戶端可遠端改名）
//   unit       選填  計數單位（預設 "本"）
//   emptyMsg   選填  空清單訊息（預設統一文案）
//   intervalKey 選填 config.json 的間隔欄位名（預設 key + "IntervalMs"）
//
// 生命週期（由 renderer.ts 驅動）：
//   init(settings) → setItems(items) → onShow() / onHide() → onKey(e)
// ==========================================================================
(function () {
  "use strict";

  /** 首字大寫（books → Books，用於元素 id：tabBooks / booksPage …） */
  function cap(s) {
    return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  }

  function el(tag, cls, id) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (id) e.id = id;
    return e;
  }

  function createCardTab(def) {
    var key = def.key;
    var K = cap(key);
    var icon = def.icon || "📄";
    var name = def.name || key;
    var unit = def.unit || "本";
    var emptyMsg = def.emptyMsg || "資料夾沒有 公告圖片，請用「電視牆用戶端上傳工具」上傳";
    var intervalKey = def.intervalKey || null;

    /* ---------- 1. 分頁按鈕（加入分頁列） ---------- */
    var tabBar = document.getElementById("tabBar");
    var tabButton = el("button", "tab", "tab" + K);
    tabButton.type = "button";
    var icoSpan = el("span", "tab-ico");
    icoSpan.textContent = icon;
    var nameSpan = el("span", "", "tabName" + K);
    nameSpan.textContent = name;
    tabButton.appendChild(icoSpan);
    tabButton.appendChild(nameSpan);
    if (tabBar) tabBar.appendChild(tabButton);

    /* ---------- 2. 頁面（完整卡片版面，與好書介紹同一造型） ---------- */
    var page = el("div", "page card-page hidden", key + "Page");

    var stage = el("main", "books-stage");
    var prevBtn = el("button", "book-nav", key + "Prev");
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "上一頁");
    prevBtn.textContent = "‹";

    var sideStart = el("aside", "book-sidebar book-sidebar--start");
    sideStart.setAttribute("data-side", "start");
    var sideStartList = el("div", "book-sidebar-list", key + "SidebarStart");
    sideStart.appendChild(sideStartList);

    var card = el("section", "book-card");
    var coverWrap = el("div", "book-cover-wrap");
    var cover = el("img", "", key + "Cover");
    cover.setAttribute("alt", "");
    coverWrap.appendChild(cover);
    var info = el("div", "book-info");
    var tag = el("span", "book-tag", key + "Tag");
    tag.textContent = icon + " " + name;
    var title = el("h2", "book-title", key + "Title");
    var counter = el("div", "book-meta", key + "Counter");
    info.appendChild(tag);
    info.appendChild(title);
    info.appendChild(counter);
    card.appendChild(coverWrap);
    card.appendChild(info);

    var sideEnd = el("aside", "book-sidebar book-sidebar--end");
    sideEnd.setAttribute("data-side", "end");
    var sideEndList = el("div", "book-sidebar-list", key + "SidebarEnd");
    sideEnd.appendChild(sideEndList);

    var nextBtn = el("button", "book-nav", key + "Next");
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "下一頁");
    nextBtn.textContent = "›";

    stage.appendChild(prevBtn);
    stage.appendChild(sideStart);
    stage.appendChild(card);
    stage.appendChild(sideEnd);
    stage.appendChild(nextBtn);

    var footer = el("footer", "books-footer");
    var dots = el("div", "book-dots", key + "Dots");
    footer.appendChild(dots);

    var msg = el("div", "msg books-msg hidden", key + "Msg");

    page.appendChild(stage);
    page.appendChild(footer);
    page.appendChild(msg);
    document.body.appendChild(page);

    /* ---------- 3. 輪播行為（各分頁原本完全相同的邏輯） ---------- */
    var els = {
      page: page, cover: cover, title: title, counter: counter,
      dots: dots, prev: prevBtn, next: nextBtn, msg: msg,
      sidebarStart: sideStartList, sidebarEnd: sideEndList
    };
    var SETTINGS = null;            // 由 init() 注入
    var items = [];                 // MediaItem[]（由 setItems 注入）
    var idx = 0;
    var paused = false;
    var timer = null;
    var bound = false;              // 已綁定事件
    var sidebarList = [];           // 側邊小卡清單（隨機 8 張）

    /** 由檔名取標題：去副檔名、去開頭編號（「01_小王子.png」→「小王子」） */
    function titleFromName(n) {
      var t = String(n || "").replace(/\.[^.]+$/, "");
      t = t.replace(/^\d+[\s._-]*/, "");
      return t.trim() || String(n || "").replace(/\.[^.]+$/, "");
    }

    function setMsg(text) {
      if (text == null) {
        els.msg.textContent = "";
        els.msg.classList.add("hidden");
      } else {
        els.msg.textContent = text;
        els.msg.classList.remove("hidden");
      }
    }

    /** 渲染目前這一張 */
    function show() {
      if (items.length === 0) {
        /* 空清單：隱藏整個卡片舞台，只顯示訊息 */
        els.page.classList.add("books-empty");
        els.cover.classList.add("hidden");
        els.cover.removeAttribute("src");
        els.title.textContent = "";
        els.counter.textContent = "";
        renderDots();
        setMsg(emptyMsg);
        return;
      }
      els.page.classList.remove("books-empty");
      if (idx >= items.length) idx = 0;
      var item = items[idx];
      setMsg(null);
      els.cover.classList.remove("hidden");
      els.cover.src = item.url;
      els.title.textContent = titleFromName(item.name);
      els.counter.textContent = paused
        ? "⏸ 暫停"
        : "第 " + (idx + 1) + " " + unit + "／共 " + items.length + " " + unit;
      renderDots();
      renderSidebar();
    }

    function renderDots() {
      var html = "";
      for (var i = 0; i < items.length; i++) {
        html += '<button type="button" class="book-dot' + (i === idx && items.length > 1 ? " active" : "") +
          '" data-idx="' + i + '" aria-label="第 ' + (i + 1) + " " + unit + '"></button>';
      }
      els.dots.innerHTML = html;
    }

    /** 側邊小卡：隨機挑選 8 張（不足 8 張時循環補滿；洗牌只在清單更新或進入分頁時重抽） */
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
      var six = sidebarList;
      var left = six.slice(0, 4);
      var right = six.slice(4, 8);
      [{ root: els.sidebarStart, list: left }, { root: els.sidebarEnd, list: right }].forEach(function (g) {
        g.root.innerHTML = "";
        g.list.forEach(function (entry) {
          var cardEl = document.createElement("div");
          cardEl.className = "book-sidebar-item" + (entry.idx === idx ? " active" : "");
          cardEl.title = titleFromName(entry.item.name);
          var img = document.createElement("img");
          img.src = entry.item.url;
          img.alt = titleFromName(entry.item.name);
          var nameEl = document.createElement("span");
          nameEl.textContent = titleFromName(entry.item.name);
          cardEl.appendChild(img);
          cardEl.appendChild(nameEl);
          cardEl.addEventListener("click", function () {
            idx = entry.idx;
            show();
            startTimer();
          });
          g.root.appendChild(cardEl);
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

    function bindEvents() {
      if (bound) return;
      bound = true;
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

    /* ---------- 4. 分頁按鈕點擊（由 renderer.ts 指定 onSelect） ---------- */
    tabButton.addEventListener("click", function () {
      if (self.onSelect) self.onSelect();
    });

    /* ---------- 5. 對 renderer.ts 的介面 ---------- */
    var self = {
      key: key,
      name: name,
      intervalKey: intervalKey,
      tabButton: tabButton,
      page: page,
      onSelect: null,

      /** 遠端更名：同時更新分頁按鈕與卡片標籤 */
      setName: function (n) {
        name = String(n || name);
        nameSpan.textContent = name;
        tag.textContent = icon + " " + name;
      },

      /** 顯示／隱藏分頁按鈕 */
      setVisible: function (v) {
        tabButton.classList.toggle("hidden", !v);
      },

      /** 注入設定（renderer.ts 取得 config 後呼叫） */
      init: function (settings) {
        SETTINGS = settings;
        bindEvents();
        show();
      },

      /** 掃描結果更新（清單有變動時也會被呼叫） */
      setItems: function (newItems) {
        bindEvents();
        items = Array.isArray(newItems) ? newItems : [];
        if (idx >= items.length) idx = 0;
        refreshSidebarList();
        show();
        if (!els.page.classList.contains("hidden")) startTimer();
      },

      /** 分頁切換到本分頁 */
      onShow: function () {
        bindEvents();
        refreshSidebarList();
        show();
        startTimer();
      },

      /** 離開本分頁 */
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
    return self;
  }

  window.createCardTab = createCardTab;
})();
