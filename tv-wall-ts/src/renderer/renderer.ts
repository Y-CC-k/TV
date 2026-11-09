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
  const videoMsg = $("videoMsg");
  const imageMsg = $("imageMsg");
  const tabBar = $("tabBar");
  const tabTv = $("tabTv");
  const tabHonor = $("tabHonor");
  const tabBooks = $("tabBooks");
  const tabCampus = $("tabCampus");
  const tabHealth = $("tabHealth");
  const tvPage = $("tvPage");
  const honorPage = $("honorPage");
  const booksPage = $("booksPage");
  const campusPage = $("campusPage");
  const healthPage = $("healthPage");
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
  let currentTab: "tv" | "honor" | "books" | "campus" | "health" = "tv";

  /** 自動切換分頁間隔（1分鐘無操作自動切換，依序 tv → honor → books → campus → health） */
  const AUTO_TAB_MS = 60000;
  const TAB_CYCLE: Array<"tv" | "honor" | "books" | "campus" | "health"> = ["tv", "honor", "books", "campus", "health"];

  /** 分頁顯示設定（false＝隱藏；未填視為顯示） */
  let tabVisibility: TabVisibility = { tv: true, honor: true, books: true, campus: true, health: true };

  /** 過濾出目前允許顯示的分頁（依 config tabs 順序 tv → honor → books） */
  function visibleTabList(): Array<"tv" | "honor" | "books" | "campus" | "health"> {
    return TAB_CYCLE.filter((k) => {
      if (k === "tv") return tabVisibility.tv !== false;
      if (k === "honor") return tabVisibility.honor !== false;
      if (k === "books") return tabVisibility.books !== false;
      if (k === "campus") return tabVisibility.campus !== false;
      return tabVisibility.health !== false;
    });
  }

  /** 套用分頁顯示／隱藏設定；目前所在分頁被隱藏時切到第一個可見分頁 */
  function applyTabs(t?: TabVisibility): void {
    tabVisibility = {
      tv: !t || t.tv !== false,
      honor: !t || t.honor !== false,
      books: !t || t.books !== false,
      campus: !t || t.campus !== false,
      health: !t || t.health !== false,
    };
    tabTv.classList.toggle("hidden", tabVisibility.tv === false);
    tabHonor.classList.toggle("hidden", tabVisibility.honor === false);
    tabBooks.classList.toggle("hidden", tabVisibility.books === false);
    tabCampus.classList.toggle("hidden", tabVisibility.campus === false);
    tabHealth.classList.toggle("hidden", tabVisibility.health === false);
    const vis = visibleTabList();
    if (vis.length === 0) {
      tabTv.classList.remove("hidden");
      tabVisibility.tv = true;
      vis.push("tv");
    }
    if (!vis.includes(currentTab)) setTab(vis[0]);
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
  function setTab(name: "tv" | "honor" | "books" | "campus" | "health"): void {
    const prevTab = currentTab;
    currentTab = name;
    document.body.classList.toggle("page-tv", name === "tv");
    document.body.classList.toggle("page-honor", name === "honor");
    document.body.classList.toggle("page-books", name === "books");
    document.body.classList.toggle("page-campus", name === "campus");
    document.body.classList.toggle("page-health", name === "health");
    tvPage.classList.toggle("hidden", name !== "tv");
    honorPage.classList.toggle("hidden", name !== "honor");
    booksPage.classList.toggle("hidden", name !== "books");
    campusPage.classList.toggle("hidden", name !== "campus");
    healthPage.classList.toggle("hidden", name !== "health");
    tabTv.classList.toggle("active", name === "tv");
    tabHonor.classList.toggle("active", name === "honor");
    tabBooks.classList.toggle("active", name === "books");
    tabCampus.classList.toggle("active", name === "campus");
    tabHealth.classList.toggle("active", name === "health");
    if (name === "tv") {
      updateLayout();
      if (videos.length > 0 && !paused) void video.play().catch(() => undefined);
      startTimer();
    } else {
      video.pause();
      stopTimer();
    }
    if (prevTab === "tv" && name !== "tv") window.HonorTab?.onHide?.();
    if (name === "honor") window.HonorTab?.onShow?.();
    if (name === "books") window.BooksTab?.onShow?.();
    if (name === "campus") window.CampusTab?.onShow?.();
    if (name === "health") window.HealthTab?.onShow?.();
    if (name !== "books" && prevTab === "books") window.BooksTab?.onHide?.();
    if (name !== "campus" && prevTab === "campus") window.CampusTab?.onHide?.();
    if (name !== "health" && prevTab === "health") window.HealthTab?.onHide?.();
    resetAutoTabTimer();
  }

  tabTv.addEventListener("click", () => setTab("tv"));
  tabHonor.addEventListener("click", () => setTab("honor"));
  tabBooks.addEventListener("click", () => setTab("books"));
  tabCampus.addEventListener("click", () => setTab("campus"));
  tabHealth.addEventListener("click", () => setTab("health"));

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
      setMsg(imageMsg, "images 資料夾沒有圖片");
      return;
    }
    setMsg(imageMsg, null);
    image.src = images[iIdx].url;
    image2.src = images[(iIdx + 1) % images.length].url;
    image3.src = images[(iIdx + 2) % images.length].url;
    image4.src = images[(iIdx + 3) % images.length].url;
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
    if (paused) {
      video.pause();
      stopTimer();
    } else {
      startTimer();
    }
  }

  /* ---------- 事件 ---------- */

  window.addEventListener("keydown", (e) => {
    if (currentTab === "honor") return; // 積點排行分頁：按鍵留給查詢輸入框
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
        e.preventDefault();
        togglePause();
        break;
      case "ArrowRight":
      case "ArrowDown":
        if (currentTab === "books") {
          window.BooksTab?.onKey?.(e);
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

    /* 積點排行設定注入（config.json 的 honor 區塊）；注入後由 honor.js 自行載入資料。
       分頁列始終可見，讓使用者可點擊切換；若無 honour 設定，點擊積點排行會切回電視牆。 */
    const honor = (cfg as Partial<AppConfig> & { honor?: HonorSettings }).honor;
    const hasHonor = !!(
      honor && honor.supabaseUrl && honor.publishableKey
    );
    if (hasHonor) {
      window.HONOR_SETTINGS = honor;
      window.HonorTab?.init?.(honor);
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

    /* 套用分頁顯示／隱藏設定（config.json 的 tabs 區塊） */
    const bootTabs = (cfg as Partial<AppConfig> & { tabs?: TabVisibility }).tabs;
    applyTabs(bootTabs);

    updateLayout();

    /* 預設分頁：只選目前允許顯示的分頁 */
    const vis = visibleTabList();
    const wantHonor = hasHonor && (cfg as Partial<AppConfig> & { defaultTab?: string }).defaultTab === "honor";
    let startTab: "tv" | "honor" | "books" | "campus" | "health" = "tv";
    if (wantHonor && vis.includes("honor")) startTab = "honor";
    else if (vis.length > 0 && !vis.includes("tv")) startTab = vis[0];
    setTab(startTab);
    if (startTab === "tv") {
      updateLayout();
    }

    /* config.json 變更時（由主程序的通知）即時套用分頁顯示 */
    tvwall.onConfigUpdated((ncfg) => {
      const nt = (ncfg as Partial<AppConfig> & { tabs?: TabVisibility }).tabs;
      applyTabs(nt);
    });

    /* tv-wall-client 上傳完成（/upload）時自動重掃（不用按 r） */
    tvwall.onSynced(() => {
      void rescan();
    });
    await rescan();
  }

  void init();
})();
