/**
 * 渲染程序：雙區版面、影片循環播放、圖片輪播、熱鍵。
 * 此檔刻意不使用 import/export，以便以指令稿方式直接被 index.html 載入。
 * （共用型別請放 src/shared/globals.d.ts，用全域宣告方式引用。）
 */
(() => {
  const $ = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error("找不到元素 #" + id);
    return el as T;
  };

  const root = $("root");
  const video = $<HTMLVideoElement>("video");
  const image = $<HTMLImageElement>("image");
  const image2 = $<HTMLImageElement>("image2");
  const image3 = $<HTMLImageElement>("image3");
  const image4 = $<HTMLImageElement>("image4");
  const imageCaption = $("imageCaption");
  const imageCaption2 = $("imageCaption2");
  const imageCaption3 = $("imageCaption3");
  const imageCaption4 = $("imageCaption4");
  const videoMsg = $("videoMsg");
  const imageMsg = $("imageMsg");
  const tabBar = $("tabBar");
  const tabTv = $("tabTv");
  const tabNameTv = $("tabNameTv");
  const tvPage = $("tvPage");
  const serverIpDisplay = $("serverIp");

  /* ---------- 卡片分頁（由 cardTabTemplate.js + cardTabs.js 模版產生） ---------- */
  const cardTabs: CardTabInstance[] = Array.isArray(window.CARD_TAB_INSTANCES) ? window.CARD_TAB_INSTANCES : [];
  const cardTabByKey: Record<string, CardTabInstance> = {};
  for (const t of cardTabs) cardTabByKey[t.key] = t;
  /* 分頁按鈕點擊 → 切換分頁（按鈕由模版建立並自行綁定 click → onSelect） */
  for (const t of cardTabs) t.onSelect = () => setTab(t.key);

  let videos: MediaItem[] = [];
  let images: MediaItem[] = [];
  let vIdx = 0;
  let iIdx = 0;
  let paused = false;
  let interval = 5000;
  let videoFit = "contain";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let autoTabTimer: ReturnType<typeof setTimeout> | null = null;

  /** 目前分頁 */
  let currentTab: string = "tv";

  /** 自動切換分頁間隔（1分鐘無操作自動切換，依 TAB_CYCLE 順序） */
  const AUTO_TAB_MS = 60000;
  /** 分頁循環順序：分頁一（電視牆）固定在最前，其後依 cardTabs.js 註冊順序 */
  const TAB_CYCLE: string[] = ["tv"].concat(cardTabs.map((t) => t.key));

  /** 分頁顯示設定（false＝隱藏；未填視為顯示） */
  let tabVisibility: Record<string, boolean> = {};

  /** 過濾出目前允許顯示的分頁 */
  function visibleTabList(): string[] {
    return TAB_CYCLE.filter((k) => tabVisibility[k] !== false);
  }

  /** 套用分頁顯示／隱藏設定；目前所在分頁被隱藏時切到第一個可見分頁 */
  function applyTabs(t?: TabVisibility): void {
    tabVisibility = {};
    for (const k of TAB_CYCLE) {
      const v = t ? (t as unknown as Record<string, boolean | undefined>)[k] : undefined;
      tabVisibility[k] = v !== false;
    }
    tabTv.classList.toggle("hidden", tabVisibility.tv === false);
    for (const t2 of cardTabs) t2.setVisible(tabVisibility[t2.key] !== false);
    const vis = visibleTabList();
    if (vis.length === 0) {
      tabTv.classList.remove("hidden");
      tabVisibility.tv = true;
      vis.push("tv");
    }
    if (!vis.includes(currentTab)) setTab(vis[0]);
  }

  /** 分頁標題預設值（config.json 的 tabNames 未填時使用；來自 cardTabs.js 註冊清單） */
  const DEFAULT_TAB_NAMES: Record<string, string> = { tv: "精彩槺榔" };
  for (const t of cardTabs) DEFAULT_TAB_NAMES[t.key] = t.name;

  /** 套用分頁標題（空白＝預設名稱）；卡片分頁同時更新分頁按鈕與卡片標籤 */
  function applyTabNames(names?: TabNames): void {
    const n = (names || {}) as Record<string, string | undefined>;
    const pick = (v: string | undefined, fallback: string): string => {
      const s = typeof v === "string" ? v.trim().slice(0, 20) : "";
      return s || fallback;
    };
    tabNameTv.textContent = pick(n.tv, DEFAULT_TAB_NAMES.tv);
    for (const t of cardTabs) t.setName(pick(n[t.key], DEFAULT_TAB_NAMES[t.key]));
  }

  function stopAutoTabTimer(): void {
    if (autoTabTimer !== null) {
      clearTimeout(autoTabTimer);
      autoTabTimer = null;
    }
  }

  function startAutoTabTimer(): void {
    stopAutoTabTimer();
    autoTabTimer = setTimeout(() => {
      const vis = visibleTabList();
      if (!vis.includes(currentTab)) return;
      const i = vis.indexOf(currentTab);
      const next = vis[(i + 1) % vis.length];
      setTab(next);
      startAutoTabTimer();
    }, AUTO_TAB_MS);
  }

  function resetAutoTabTimer(): void {
    stopAutoTabTimer();
    startAutoTabTimer();
  }

  function inTvMode(): boolean {
    return currentTab === "tv";
  }

  /** 切換分頁：離開電視牆時暫停播放，回來時恢復 */
  function setTab(name: string): void {
    const prevTab = currentTab;
    currentTab = name;
    for (const k of TAB_CYCLE) document.body.classList.toggle("page-" + k, k === name);
    tvPage.classList.toggle("hidden", name !== "tv");
    tabTv.classList.toggle("active", name === "tv");
    for (const t of cardTabs) {
      t.page.classList.toggle("hidden", name !== t.key);
      t.tabButton.classList.toggle("active", name === t.key);
    }
    if (name === "tv") {
      updateLayout();
      if (videos.length > 0 && !paused) void video.play().catch(() => undefined);
      startTimer();
    } else {
      video.pause();
      stopTimer();
    }
    for (const t of cardTabs) {
      if (name === t.key) t.onShow();
      else if (prevTab === t.key) t.onHide();
    }
    resetAutoTabTimer();
  }

  tabTv.addEventListener("click", () => setTab("tv"));

  /** 直立＝上下各半、橫向＝左右各半（同原 Python 版） */
  function updateLayout(): void {
    const landscape = window.innerWidth >= window.innerHeight;
    root.classList.toggle("landscape", landscape);
    root.classList.toggle("portrait", !landscape);
    // 寬螢幕：不變形 (contain)；直立：可變形 (fill)
    video.style.objectFit = landscape ? videoFit : "fill";
  }

  /* 電視牆頁 hidden 時更新版面沒意義；切回 tv 頁時會呼叫 updateLayout */
  function updateIfVisible(): void {
    if (inTvMode()) updateLayout();
  }

  function setMsg(box: HTMLElement, text: string | null): void {
    if (text === null) {
      box.textContent = "";
      box.classList.add("hidden");
    } else {
      box.textContent = text;
      box.classList.remove("hidden");
    }
  }

  /* ---------- 影片 ---------- */

  function showVideo(): void {
    if (videos.length === 0) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      setMsg(videoMsg, "video 資料夾沒有可播放的影片");
      return;
    }
    setMsg(videoMsg, null);
    video.src = videos[vIdx].url;
    if (!paused) void video.play().catch(() => undefined);
  }

  function nextVideo(): void {
    if (videos.length === 0) return;
    vIdx = (vIdx + 1) % videos.length;
    showVideo();
  }

  video.addEventListener("ended", () => nextVideo());

  video.addEventListener("error", () => {
    if (videos.length === 0) return;
    const item = videos[vIdx];
    setMsg(videoMsg, `無法播放：${item ? item.name : ""}（此格式瀏覽器不支援）`);
    // 避免全部檔案都不支援時變成無限緊密迴圈
    window.setTimeout(() => nextVideo(), 1000);
  });

  /* ---------- 圖片 ---------- */

  function showImage(): void {
    if (images.length === 0) {
      image.removeAttribute("src");
      image2.removeAttribute("src");
      image3.removeAttribute("src");
      image4.removeAttribute("src");
      for (const cap of [imageCaption, imageCaption2, imageCaption3, imageCaption4]) cap.textContent = "";
      setMsg(imageMsg, "images 資料夾沒有圖片");
      return;
    }
    setMsg(imageMsg, null);
    for (let k = 0; k < 4; k++) {
      const item = images[(iIdx + k) % images.length];
      const img = k === 0 ? image : k === 1 ? image2 : k === 2 ? image3 : image4;
      const cap = k === 0 ? imageCaption : k === 1 ? imageCaption2 : k === 2 ? imageCaption3 : imageCaption4;
      /* 重新觸發淡入動畫：先移除 class，reflow 後再加回 */
      cap.classList.remove("caption-in");
      img.src = item.url;
      cap.textContent = titleFromName(item.name);
      void cap.offsetWidth; /* 強制 reflow，讓動畫可重新播放 */
      cap.classList.add("caption-in");
    }
  }

  /** 由檔名取標題顯示（去副檔名、去開頭編號），與電視牆/books.js 相同邏輯 */
  function titleFromName(name: string): string {
    let t = String(name || "").replace(/\.[^.]+$/, "");
    t = t.replace(/^\d+[\s._-]*/, "");
    return t.trim() || String(name || "").replace(/\.[^.]+$/, "");
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function startTimer(): void {
    stopTimer();
    if (paused || images.length <= 1) return;
    timer = setTimeout(() => {
      nextImage();
      startTimer();
    }, interval);
  }

  function nextImage(): void {
    if (images.length === 0) return;
    iIdx = (iIdx + 1) % images.length;
    showImage();
  }

  function prevImage(): void {
    if (images.length === 0) return;
    iIdx = (iIdx - 1 + images.length) % images.length;
    showImage();
  }

  /** 手動翻頁後重啟計時器（同原 Python 版） */
  function manualStep(step: 1 | -1): void {
    if (step === 1) nextImage();
    else prevImage();
    startTimer();
  }

  /* ---------- 暫停／掃描 ---------- */

  function togglePause(): void {
    paused = !paused;
    if (paused) {
      video.pause();
      stopTimer();
    } else {
      if (videos.length > 0) void video.play().catch(() => undefined);
      startTimer();
    }
  }

  async function rescan(): Promise<void> {
    const result = await tvwall.scan();
    videos = result.videos;
    images = result.images;
    vIdx = 0;
    iIdx = 0;
    showVideo();
    showImage();
    /* 卡片分頁：清單更新（清單 key 與分頁 key 相同，如 result.campusHonor） */
    for (const t of cardTabs) {
      const list = (result as unknown as Record<string, MediaItem[] | undefined>)[t.key];
      t.setItems(list ?? []);
    }
    if (paused) {
      video.pause();
      stopTimer();
    } else {
      startTimer();
    }
  }

  /* ---------- 事件 ---------- */

  window.addEventListener("keydown", (e) => {
      switch (e.key) {
      case "Escape":
        e.preventDefault();
        void tvwall.close();
        break;
      case "F11":
        e.preventDefault();
        void tvwall.toggleFullscreen();
        break;
      case " ":
      case "Spacebar": {
        /* 卡片分頁：Space＝暫停輪播；電視牆：暫停播放 */
        const inst = cardTabByKey[currentTab];
        if (inst && inst.onKey(e)) break;
        e.preventDefault();
        togglePause();
        break;
      }
      case "ArrowRight":
      case "ArrowDown": {
        const inst = cardTabByKey[currentTab];
        if (inst) {
          inst.onKey(e);
          break;
        }
        e.preventDefault();
        manualStep(1);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        const inst = cardTabByKey[currentTab];
        if (inst) {
          inst.onKey(e);
          break;
        }
        e.preventDefault();
        manualStep(-1);
        break;
      }
      case "r":
      case "R":
        e.preventDefault();
        void rescan();
        break;
      default:
        break;
    }
  });

  document.addEventListener("dblclick", () => {
    if (currentTab === "tv") void tvwall.close();
  });

  window.addEventListener("resize", updateIfVisible);

  /* ---------- 啟動 ---------- */

  async function init(): Promise<void> {
    const cfg = await tvwall.config();
    interval = cfg.imageIntervalMs;
    videoFit = cfg.videoFit || "contain";
    image.style.objectFit = cfg.imageFit;
    image2.style.objectFit = cfg.imageFit;
    image3.style.objectFit = cfg.imageFit;
    image4.style.objectFit = cfg.imageFit;

    /* 顯示公告機 IP（右上角），供用戶端輸入 */
    if (serverIpDisplay) {
      serverIpDisplay.textContent = cfg.localIP || "--";
    }

    tabBar.classList.remove("hidden"); // 分頁按鈕始終存在

    /* 卡片分頁設定注入（每頁停留毫秒，欄位名由模版實例的 intervalKey 決定） */
    for (const t of cardTabs) {
      const cfgAny = cfg as unknown as Record<string, unknown>;
      const raw = cfgAny[t.intervalKey || t.key + "IntervalMs"];
      const ms = typeof raw === "number" && raw > 0 ? raw : cfg.bookIntervalMs;
      t.init({ intervalMs: ms });
    }

    /* 套用分頁顯示／隱藏設定（config.json 的 tabs 區塊） */
    const bootTabs = (cfg as Partial<AppConfig> & { tabs?: TabVisibility }).tabs;
    applyTabs(bootTabs);

    /* 套用分頁標題（config.json 的 tabNames 區塊） */
    applyTabNames((cfg as Partial<AppConfig> & { tabNames?: TabNames }).tabNames);

    updateLayout();

    /* 預設分頁：只選目前允許顯示的分頁 */
    const vis = visibleTabList();
    let startTab: string = "tv";
    if (vis.length > 0 && !vis.includes("tv")) startTab = vis[0];
    setTab(startTab);
    if (startTab === "tv") {
      updateLayout();
    }

    /* config.json 變更時（由主程序的通知）即時套用分頁顯示與標題 */
    tvwall.onConfigUpdated((ncfg) => {
      const nt = (ncfg as Partial<AppConfig> & { tabs?: TabVisibility }).tabs;
      applyTabs(nt);
      applyTabNames((ncfg as Partial<AppConfig> & { tabNames?: TabNames }).tabNames);
    });

    /* tv-wall-client 上傳完成（/upload）時自動重掃（不用按 r） */
    tvwall.onSynced(() => {
      void rescan();
    });
    await rescan();
  }

  void init();
})();
