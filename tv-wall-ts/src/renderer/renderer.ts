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
  const tabBooks = $("tabBooks");
  const tabCampus = $("tabCampus");
  const tabHealth = $("tabHealth");
  const tabCounseling = $("tabCounseling");
  const tabNameTv = $("tabNameTv");
  const tabNameBooks = $("tabNameBooks");
  const tabNameCampus = $("tabNameCampus");
  const tabNameHealth = $("tabNameHealth");
  const tabNameCounseling = $("tabNameCounseling");
  const tvPage = $("tvPage");
  const booksPage = $("booksPage");
  const campusPage = $("campusPage");
  const healthPage = $("healthPage");
  const counselingPage = $("counselingPage");
  const serverIpDisplay = $("serverIp");

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
  let currentTab: "tv" | "books" | "campus" | "health" | "counseling" = "tv";

  /** 自動切換分頁間隔（1分鐘無操作自動切換，依序 tv → honor → books → campus → health） */
  const AUTO_TAB_MS = 60000;
  const TAB_CYCLE: Array<"tv" | "books" | "campus" | "health" | "counseling"> = ["tv", "books", "campus", "health", "counseling"];

  /** 分頁顯示設定（false＝隱藏；未填視為顯示） */
  let tabVisibility: TabVisibility = { tv: true, books: true, campus: true, health: true, counseling: true };

  /** 過濾出目前允許顯示的分頁（依 config tabs 順序 tv → honor → books） */
  function visibleTabList(): Array<"tv" | "books" | "campus" | "health" | "counseling"> {
    return TAB_CYCLE.filter((k) => {
      if (k === "tv") return tabVisibility.tv !== false;
      if (k === "books") return tabVisibility.books !== false;
      if (k === "campus") return tabVisibility.campus !== false;
      if (k === "health") return tabVisibility.health !== false;
      return tabVisibility.counseling !== false;
    });
  }

  /** 套用分頁顯示／隱藏設定；目前所在分頁被隱藏時切到第一個可見分頁 */
  function applyTabs(t?: TabVisibility): void {
    tabVisibility = {
      tv: !t || t.tv !== false,
      books: !t || t.books !== false,
      campus: !t || t.campus !== false,
      health: !t || t.health !== false,
      counseling: !t || t.counseling !== false,
    };
    tabTv.classList.toggle("hidden", tabVisibility.tv === false);
    tabBooks.classList.toggle("hidden", tabVisibility.books === false);
    tabCampus.classList.toggle("hidden", tabVisibility.campus === false);
    tabHealth.classList.toggle("hidden", tabVisibility.health === false);
    tabCounseling.classList.toggle("hidden", tabVisibility.counseling === false);
    const vis = visibleTabList();
    if (vis.length === 0) {
      tabTv.classList.remove("hidden");
      tabVisibility.tv = true;
      vis.push("tv");
    }
    if (!vis.includes(currentTab)) setTab(vis[0]);
  }

  /** 分頁標題預設值（config.json 的 tabNames 未填時使用） */
  const DEFAULT_TAB_NAMES: Record<"tv" | "books" | "campus" | "health" | "counseling", string> = {
    tv: "精彩槺榔",
    books: "好書介紹",
    campus: "校園風雲",
    health: "衛教宣導",
    counseling: "輔導室公告",
  };

  /** 套用分頁標題（空白＝預設名稱） */
  function applyTabNames(names?: { tv?: string; books?: string; campus?: string; health?: string; counseling?: string }): void {
    const n = names || {};
    const pick = (v: string | undefined, k: "tv" | "books" | "campus" | "health" | "counseling"): string => {
      const s = typeof v === "string" ? v.trim().slice(0, 20) : "";
      return s || DEFAULT_TAB_NAMES[k];
    };
    tabNameTv.textContent = pick(n.tv, "tv");
    tabNameBooks.textContent = pick(n.books, "books");
    tabNameCampus.textContent = pick(n.campus, "campus");
    tabNameHealth.textContent = pick(n.health, "health");
    tabNameCounseling.textContent = pick(n.counseling, "counseling");
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
  function setTab(name: "tv" | "books" | "campus" | "health" | "counseling"): void {
    const prevTab = currentTab;
    currentTab = name;
    document.body.classList.toggle("page-tv", name === "tv");
    document.body.classList.toggle("page-books", name === "books");
    document.body.classList.toggle("page-campus", name === "campus");
    document.body.classList.toggle("page-health", name === "health");
    document.body.classList.toggle("page-counseling", name === "counseling");
    tvPage.classList.toggle("hidden", name !== "tv");
    booksPage.classList.toggle("hidden", name !== "books");
    campusPage.classList.toggle("hidden", name !== "campus");
    healthPage.classList.toggle("hidden", name !== "health");
    counselingPage.classList.toggle("hidden", name !== "counseling");
    tabTv.classList.toggle("active", name === "tv");
    tabBooks.classList.toggle("active", name === "books");
    tabCampus.classList.toggle("active", name === "campus");
    tabHealth.classList.toggle("active", name === "health");
    tabCounseling.classList.toggle("active", name === "counseling");
    if (name === "tv") {
      updateLayout();
      if (videos.length > 0 && !paused) void video.play().catch(() => undefined);
      startTimer();
    } else {
      video.pause();
      stopTimer();
    }
    if (name === "books") window.BooksTab?.onShow?.();
    if (name === "campus") window.CampusTab?.onShow?.();
    if (name === "health") window.HealthTab?.onShow?.();
    if (name === "counseling") window.CounselingTab?.onShow?.();
    if (name !== "books" && prevTab === "books") window.BooksTab?.onHide?.();
    if (name !== "campus" && prevTab === "campus") window.CampusTab?.onHide?.();
    if (name !== "health" && prevTab === "health") window.HealthTab?.onHide?.();
    if (name !== "counseling" && prevTab === "counseling") window.CounselingTab?.onHide?.();
    resetAutoTabTimer();
  }

  tabTv.addEventListener("click", () => setTab("tv"));
  tabBooks.addEventListener("click", () => setTab("books"));
  tabCampus.addEventListener("click", () => setTab("campus"));
  tabHealth.addEventListener("click", () => setTab("health"));
tabCounseling.addEventListener("click", () => setTab("counseling"));

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
    /* 好書介紹分頁：清單更新（不在該分頁時也只是更新內部狀態） */
    window.BooksTab?.setItems(result.books ?? []);
    /* 校園風雲分頁：清單更新 */
    window.CampusTab?.setItems(result.campus ?? []);
    /* 衛教宣導分頁：清單更新 */
    window.HealthTab?.setItems(result.health ?? []);
    /* 輔導室公告分頁：清單更新 */
    window.CounselingTab?.setItems(result.counseling ?? []);
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
      case "Spacebar":
        if (currentTab === "books") {
          if (window.BooksTab?.onKey?.(e)) break; // 好書介紹：Space＝暫停輪播
        }
        if (currentTab === "counseling") {
          if (window.CounselingTab?.onKey?.(e)) break;
        }
        e.preventDefault();
        togglePause();
        break;
      case "ArrowRight":
      case "ArrowDown":
        if (currentTab === "books") {
          window.BooksTab?.onKey?.(e);
          break;
        }
        if (currentTab === "counseling") {
          window.CounselingTab?.onKey?.(e);
          break;
        }
        e.preventDefault();
        manualStep(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        if (currentTab === "books") {
          window.BooksTab?.onKey?.(e);
          break;
        }
        if (currentTab === "counseling") {
          window.CounselingTab?.onKey?.(e);
          break;
        }
        e.preventDefault();
        manualStep(-1);
        break;
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

    /* 好書介紹分頁設定注入（books 資料夾清單由 rescan 給 BooksTab.setItems） */
    const bookSettings: BookSettings = {
      intervalMs: cfg.bookIntervalMs,
    };
    window.BOOK_SETTINGS = bookSettings;
    window.BooksTab?.init?.(bookSettings);

    /* 校園風雲分頁設定注入（campus 資料夾清單由 rescan 給 CampusTab.setItems） */
    const campusSettings: BookSettings = {
      intervalMs: (cfg as Partial<AppConfig> & { campusIntervalMs?: number }).campusIntervalMs ?? cfg.bookIntervalMs,
    };
    window.CAMPUS_SETTINGS = campusSettings;
    window.CampusTab?.init?.(campusSettings);

    /* 衛教宣導分頁設定注入（health 資料夾清單由 rescan 給 HealthTab.setItems） */
    const healthSettings: BookSettings = {
      intervalMs: (cfg as Partial<AppConfig> & { healthIntervalMs?: number }).healthIntervalMs ?? cfg.bookIntervalMs,
    };
    window.HEALTH_SETTINGS = healthSettings;
    window.HealthTab?.init?.(healthSettings);

    /* 輔導室公告分頁設定注入 */
    const counselingSettings: BookSettings = {
      intervalMs: (cfg as Partial<AppConfig> & { counselingIntervalMs?: number }).counselingIntervalMs ?? cfg.bookIntervalMs,
    };
    window.COUNSELING_SETTINGS = counselingSettings;
    window.CounselingTab?.init?.(counselingSettings);

    /* 套用分頁顯示／隱藏設定（config.json 的 tabs 區塊） */
    const bootTabs = (cfg as Partial<AppConfig> & { tabs?: TabVisibility }).tabs;
    applyTabs(bootTabs);

    /* 套用分頁標題（config.json 的 tabNames 區塊） */
    applyTabNames((cfg as Partial<AppConfig> & { tabNames?: TabNames }).tabNames);

    updateLayout();

    /* 預設分頁：只選目前允許顯示的分頁 */
    const vis = visibleTabList();
    let startTab: "tv" | "books" | "campus" | "health" | "counseling" = "tv";
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
