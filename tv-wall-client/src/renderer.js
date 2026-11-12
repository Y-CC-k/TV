(async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- 狀態 ---------- */
  let servers = JSON.parse(localStorage.getItem("tvwall_servers") || "[]");
  /* 已刪除公告機的墓碑（ip:port）：啟動合併 config.json 時跳過，避免被刪除的公告機復活
     （config.json 寫入失敗或人工維護時，刪除仍能持久保留） */
  let removedServers = JSON.parse(localStorage.getItem("tvwall_removed_servers") || "[]");
  function serverAddrKey(ip, port) {
    const p = String(port == null ? 8123 : port).trim() || "8123";
    return `${String(ip || "").trim()}:${p}`;
  }
  function saveRemovedServers() {
    localStorage.setItem("tvwall_removed_servers", JSON.stringify(removedServers));
  }
  let selectedServerId = null; // 目前選定的公告機 ID（用於上傳/檔案清單）
  let currentBaseUrl = "";     // 目前選定公告機的 baseUrl
  let bookSelectedFiles = []; // File[] 多個選中的檔案

  /* ---------- 榮譽榜狀態 ---------- */

  /* ---------- 元素：大分頁 ---------- */
  const tabBooks = $("tabBooks");
  const tabSettings = $("tabSettings");
  const panelBooks = $("panelBooks");
  const panelSettings = $("panelSettings");

  /* ---------- 元素：公告機管理 ---------- */
  const serverName = $("serverName");
  const serverIp = $("serverIp");
  const serverPort = $("serverPort");
  const btnAddServer = $("btnAddServer");
  const serverList = $("serverList");

  /* ---------- 元素：資料傳輸 ---------- */
  const bookServerSelect = $("bookServerSelect");
  const bookServerStatus = $("bookServerStatus");
  const bookTitleInput = $("bookTitleInput");
  const bookTitleRow = $("bookTitleRow");
  const uploadAllServers = $("uploadAllServers");
  const bookFileTypeRadios = document.querySelectorAll('input[name="bookFileType"]');
  const bookBtnSelectFile = $("bookBtnSelectFile");
  const bookFileInput = $("bookFileInput");
  const bookSelectedFile = $("bookSelectedFile");
  const bookBtnUpload = $("bookBtnUpload");
  const bookProgress = $("bookProgress");
  const bookProgressText = $("bookProgressText");
  const bookMsg = $("bookMsg");
  const bookBtnRefresh = $("bookBtnRefresh");
  const bookListCount = $("bookListCount");
  const bookTableBody = $("bookTableBody");
  const bookTableWrap = $("bookTableWrap");

  /* ---------- 元素：榮譽榜設定 ---------- */
  const tabServerSelect = $("tabServerSelect");
  const tabChkTv = $("tabChkTv");
  const tabChkBooks = $("tabChkBooks");
  const tabChkCampus = $("tabChkCampus");
  const tabChkHealth = $("tabChkHealth");
  const tabChkCampusHonor = $("tabChkCampusHonor");
  const btnLoadTabs = $("btnLoadTabs");
  const tabNameTv = $("tabNameTv");
  const tabNameBooks = $("tabNameBooks");
  const tabNameCampus = $("tabNameCampus");
  const tabNameHealth = $("tabNameHealth");
  const tabNameCounseling = $("tabNameCounseling");
  const tabNameCampusHonor = $("tabNameCampusHonor");
  /* 顯示分頁勾選與類型分類的名稱（隨分頁標題變動） */
  const tabLabelTv = $("tabLabelTv");
  const tabLabelBooks = $("tabLabelBooks");
  const tabLabelCampus = $("tabLabelCampus");
  const tabLabelHealth = $("tabLabelHealth");
  const tabLabelCounseling = $("tabLabelCounseling");
  const tabLabelCampusHonor = $("tabLabelCampusHonor");
  const typeLabelBook = $("typeLabelBook");
  const typeLabelCampus = $("typeLabelCampus");
  const typeLabelHealth = $("typeLabelHealth");
  const typeLabelCounseling = $("typeLabelCounseling");
  const typeLabelCampusHonor = $("typeLabelCampusHonor");
  const typeLabelBook2 = $("typeLabelBook2");
  const typeLabelCampus2 = $("typeLabelCampus2");
  const typeLabelHealth2 = $("typeLabelHealth2");
  const typeLabelCounseling2 = $("typeLabelCounseling2");
  const typeLabelCampusHonor2 = $("typeLabelCampusHonor2");
  const btnApplyTabs = $("btnApplyTabs");
  const tabApplyMsg = $("tabApplyMsg");
  const newPasswordInput = $("newPasswordInput");
  const btnEyePassword = $("btnEyePassword");
  const btnSavePassword = $("btnSavePassword");
  const passwordMsg = $("passwordMsg");
  const btnWinMin = $("btnWinMin");
  const btnWinMax = $("btnWinMax");
  const btnWinClose = $("btnWinClose");

  /* ---------- 無邊框視窗控制 ---------- */
  btnWinMin.addEventListener("click", () => window.tvwallClient.windowMinimize && window.tvwallClient.windowMinimize());
  btnWinMax.addEventListener("click", () => window.tvwallClient.windowMaximize && window.tvwallClient.windowMaximize());
  btnWinClose.addEventListener("click", () => window.tvwallClient.windowClose && window.tvwallClient.windowClose());
  $("titlebar").addEventListener("dblclick", () => window.tvwallClient.windowMaximize && window.tvwallClient.windowMaximize());

  /* ---------- 元素：學生積點查詢 ---------- */

  /* ---------- 元素：學生加分 ---------- */
  const addPointsCardId = $("addPointsCardId");
  const addPointsMsg = $("addPointsMsg");

  /* ---------- 元素：學生加分（班級勾選） ---------- */
  const addPointsClassSelect = $("addPointsClassSelect");
  const btnToggleAllStudents = $("btnToggleAllStudents");
  const classStudentList = $("classStudentList");
  const classSelectedCount = $("classSelectedCount");

  /* ---------- 工具函式 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function saveServers() {
    localStorage.setItem("tvwall_servers", JSON.stringify(servers));
    try {
      const flat = servers.map((s) => ({
        name: s.name,
        ip: s.ip,
        port: s.port === "" ? 8123 : Number(s.port || 8123),
      }));
      const r = tvwallClient.saveBootConfig({ servers: flat });
      r.then((res) => {
        if (res && !res.ok) console.warn("[config.json] 寫入失敗：", res.error);
      });
    } catch (err) {
      console.warn("[config.json] 寫入失敗：", err);
    }
    renderServerList();
    populateServerSelects();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  async function getStoredPassword() {
    try {
      const cfg = await window.tvwallClient.getBootConfig();
      return (cfg && cfg.raw && cfg.raw.password) || "26562684";
    } catch (e) {
      return "26562684";
    }
  }

  async function ensurePassword() {
    const pwd = await getStoredPassword();
    while (true) {
      const entered = await promptMsg("請輸入開啟密碼", "");
      if (entered === null) {
        try { window.tvwallClient.close && await window.tvwallClient.close(); } catch (e) {}
        return false;
      }
      if (entered === pwd) return true;
      await alertMsg("密碼錯誤，請重新輸入");
    }
  }


  /* ---------- 自訂對話框（Electron renderer 不支援原生 prompt/confirm/alert） ---------- */
  function showDialog(opts) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;";
      const box = document.createElement("div");
      box.style.cssText = "background:#1e293b;color:#e2e8f0;border-radius:12px;padding:20px 24px;min-width:320px;max-width:480px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:inherit;";
      const msg = document.createElement("div");
      msg.style.cssText = "margin-bottom:14px;font-size:15px;line-height:1.5;white-space:pre-wrap;";
      msg.textContent = opts.message || "";
      box.appendChild(msg);

      let input = null;
      if (opts.prompt) {
        input = document.createElement("input");
        input.type = opts.password ? "password" : "text";
        input.value = opts.defaultValue || "";
        input.style.cssText = "flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px;box-sizing:border-box;";
        let inputWrap = input;
        if (opts.password) {
          inputWrap = document.createElement("div");
          inputWrap.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:14px;";
          let inputEye = document.createElement("button");
          inputEye.type = "button";
          inputEye.textContent = "👁";
          inputEye.title = "顯示密碼";
          inputEye.style.cssText = "padding:8px 10px;border-radius:8px;border:1px solid #475569;background:transparent;color:#cbd5e1;cursor:pointer;font-size:14px;flex-shrink:0;";
          inputEye.addEventListener("click", () => {
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            inputEye.textContent = show ? "🙈" : "👁";
            inputEye.title = show ? "隱藏密碼" : "顯示密碼";
          });
          inputWrap.appendChild(input);
          inputWrap.appendChild(inputEye);
        }
        box.appendChild(inputWrap);
      }

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:10px;";
      const btnCancel = document.createElement("button");
      btnCancel.textContent = opts.cancelText || "取消";
      btnCancel.style.cssText = "padding:7px 16px;border-radius:8px;border:1px solid #475569;background:transparent;color:#cbd5e1;cursor:pointer;";
      const btnOk = document.createElement("button");
      btnOk.textContent = opts.okText || "確定";
      btnOk.style.cssText = "padding:7px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;";
      btnRow.appendChild(btnCancel);
      btnRow.appendChild(btnOk);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      if (input) setTimeout(() => input.focus(), 0);

      function close(result) {
        overlay.remove();
        resolve(result);
      }
      btnOk.addEventListener("click", () => {
        if (input) close(input.value);
        else close(true);
      });
      btnCancel.addEventListener("click", () => {
        if (input) close(null);
        else close(false);
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); btnOk.click(); }
        else if (e.key === "Escape") { e.preventDefault(); btnCancel.click(); }
      });
      overlay.tabIndex = -1;
      overlay.focus();
    });
  }

  function alertMsg(message) {
    return showDialog({ message, okText: "確定", cancelText: "　" }).then(() => undefined);
  }
  function confirmMsg(message) {
    return showDialog({ message, okText: "確定", cancelText: "取消" });
  }
  function promptMsg(message, defaultValue) {
    return showDialog({ message, prompt: true, password: true, defaultValue, okText: "確定", cancelText: "取消" });
  }

  /* ---------- 公告機編輯表單 ---------- */
  function editServerDialog(s) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;";
      const box = document.createElement("div");
      box.style.cssText = "background:#1e293b;color:#e2e8f0;border-radius:12px;padding:20px 24px;min-width:360px;max-width:480px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:inherit;";
      const title = document.createElement("div");
      title.style.cssText = "font-size:16px;font-weight:700;margin-bottom:14px;";
      title.textContent = "編輯公告機";
      box.appendChild(title);

      function makeField(label, value) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "margin-bottom:12px;";
        const lab = document.createElement("label");
        lab.style.cssText = "display:block;font-size:13px;color:#94a3b8;margin-bottom:4px;";
        lab.textContent = label;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = value || "";
        inp.style.cssText = "width:100%;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px;box-sizing:border-box;";
        wrap.appendChild(lab);
        wrap.appendChild(inp);
        return { wrap, inp };
      }

      const f1 = makeField("名稱", s.name);
      const f2 = makeField("IP 位址", s.ip);
      const f3 = makeField("Port", s.port);
      box.appendChild(f1.wrap);
      box.appendChild(f2.wrap);
      box.appendChild(f3.wrap);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:6px;";
      const btnCancel = document.createElement("button");
      btnCancel.textContent = "取消";
      btnCancel.style.cssText = "padding:7px 16px;border-radius:8px;border:1px solid #475569;background:transparent;color:#cbd5e1;cursor:pointer;";
      const btnOk = document.createElement("button");
      btnOk.textContent = "儲存";
      btnOk.style.cssText = "padding:7px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;";
      btnRow.appendChild(btnCancel);
      btnRow.appendChild(btnOk);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      setTimeout(() => f1.inp.focus(), 0);

      function close(result) {
        overlay.remove();
        resolve(result);
      }
      btnOk.addEventListener("click", () => {
        close({ name: f1.inp.value, ip: f2.inp.value, port: f3.inp.value });
      });
      btnCancel.addEventListener("click", () => close(null));
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); btnOk.click(); }
        else if (e.key === "Escape") { e.preventDefault(); btnCancel.click(); }
      });
      overlay.tabIndex = -1;
      overlay.focus();
    });
  }

  /* ---------- 大分頁切換 ---------- */
  function switchTab(tab) {
    [tabBooks, tabSettings].forEach((t) => {
      t.classList.remove("tab--active");
      t.setAttribute("aria-selected", "false");
    });
    [panelBooks, panelSettings].forEach((p) => p.classList.add("hidden"));
    tab.classList.add("tab--active");
    tab.setAttribute("aria-selected", "true");

    if (tab === tabBooks) {
      panelBooks.classList.remove("hidden");
      loadBookList();
    } else if (tab === tabSettings) {
      panelSettings.classList.remove("hidden");
    }
  }

  tabBooks.addEventListener("click", () => switchTab(tabBooks));
  tabSettings.addEventListener("click", () => switchTab(tabSettings));

  /* ---------- 公告機管理 ---------- */
  function renderServerList() {
    serverList.innerHTML = "";

    if (servers.length === 0) {
      serverList.innerHTML = '<div style="padding:16px;color:#94a3b8;text-align:center;">尚未新增公告機</div>';
      return;
    }

    servers.forEach((s) => {
      const div = document.createElement("div");
      div.className = "server-item";
      div.innerHTML = `
        <div class="server-info">
          <div class="server-name">${esc(s.name)}</div>
          <div class="server-addr">${esc(s.ip)}:${esc(s.port)}</div>
        </div>
        <div class="server-actions">
          <button class="btn-edit" data-id="${s.id}" title="編輯">編輯</button>
          <button class="btn-delete" data-id="${s.id}" title="刪除">刪除</button>
        </div>
      `;

      serverList.appendChild(div);
    });

    // 綁定事件

    serverList.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const s = servers.find((x) => x.id === id);
        if (!s) return;
        const res = await editServerDialog(s);
        if (!res) return;
        s.name = (res.name || "").trim() || s.name;
        s.ip = (res.ip || "").trim() || s.ip;
        s.port = (res.port || "").trim() || s.port;
        s.online = false;
        /* 編輯後的新地址解除墓碑（之後可以正常管理） */
        const key = serverAddrKey(s.ip, s.port);
        removedServers = removedServers.filter((k) => k !== key);
        saveRemovedServers();
        saveServers();
      });
    });

    serverList.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const s = servers.find((x) => x.id === id);
        if (!s) return;
        if (!(await confirmMsg("確定要刪除此公告機嗎？"))) return;
        /* 記入墓碑：下次啟動合併 config.json 時不再把它加回來 */
        const key = serverAddrKey(s.ip, s.port);
        if (!removedServers.includes(key)) {
          removedServers.push(key);
          saveRemovedServers();
        }
        servers = servers.filter((x) => x.id !== id);
        if (selectedServerId === id) {
          selectedServerId = null;
          currentBaseUrl = "";
          setBookServerStatus("", null);
        }
        saveServers();
      });
    });
  }

  btnAddServer.addEventListener("click", async () => {
    const name = serverName.value.trim();
    const ip = serverIp.value.trim();
    const port = serverPort.value.trim();
    if (!name || !ip) {
      await alertMsg("請輸入名稱與 IP");
      return;
    }
    /* 使用者手動新增：解除同地址的墓碑（之後可以正常管理） */
    const key = serverAddrKey(ip, port);
    removedServers = removedServers.filter((k) => k !== key);
    saveRemovedServers();
    servers.push({
      id: generateId(),
      name,
      ip,
      port,
      online: false,
    });
    serverName.value = "";
    serverIp.value = "";
    serverPort.value = "8123";
    saveServers();
  });
  btnSavePassword.addEventListener("click", async () => {
    const np = newPasswordInput.value.trim();
    if (!np) { await alertMsg("請輸入新密碼"); return; }
    try {
      await window.tvwallClient.saveBootConfig({ password: np });
      passwordMsg.textContent = "密碼已更新";
      passwordMsg.className = "msg success";
      newPasswordInput.value = "";
    } catch (err) {
      passwordMsg.textContent = "更新失敗：" + err.message;
      passwordMsg.className = "msg error";
    }
  });
  btnEyePassword.addEventListener("click", () => {
    const show = newPasswordInput.type === "password";
    newPasswordInput.type = show ? "text" : "password";
    btnEyePassword.textContent = show ? "🙈" : "👁";
    btnEyePassword.title = show ? "隱藏密碼" : "顯示密碼";
  });



  /* ---------- 分頁顯示設定（讀寫公告機 config.json 的 tabs 區塊） ---------- */
  function tabApplyStatus(text, isError) {
    tabApplyMsg.textContent = text;
    tabApplyMsg.className = isError ? "msg error" : "msg success";
  }

  function tabServerOrNull() {
    const s = servers.find((x) => x.id === tabServerSelect.value);
    return s ? { s, base: `http://${s.ip}:${s.port}` } : null;
  }

  /* 分頁標題預設值（公告機未設定時使用） */
  const DEFAULT_TAB_NAMES = { tv: "精彩槺榔", books: "好書介紹", campus: "校園風雲", health: "衛教宣導", counseling: "輔導室公告", campusHonor: "校園榮譽榜" };
  let currentTabNames = { ...DEFAULT_TAB_NAMES };

  /** 依分頁標題更新：顯示分頁勾選名稱、資料傳輸類型分類名稱、上傳區塊標題 */
  function applyTabNamesToUi(names) {
    const n = names || {};
    const pick = (v, k) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 20) : DEFAULT_TAB_NAMES[k]);
    currentTabNames = { tv: pick(n.tv, "tv"), books: pick(n.books, "books"), campus: pick(n.campus, "campus"), health: pick(n.health, "health"), counseling: pick(n.counseling, "counseling"), campusHonor: pick(n.campusHonor, "campusHonor") };
    /* 顯示分頁勾選（榮譽榜固定不變） */
    tabLabelTv.textContent = currentTabNames.tv;
    tabLabelBooks.textContent = currentTabNames.books;
    tabLabelCampus.textContent = currentTabNames.campus;
    tabLabelHealth.textContent = currentTabNames.health;
    tabLabelCounseling.textContent = currentTabNames.counseling;
    tabLabelCampusHonor.textContent = currentTabNames.campusHonor;
    /* 資料傳輸的類型分類（影片／照片固定不變） */
    typeLabelBook.textContent = currentTabNames.books;
    typeLabelCampus.textContent = currentTabNames.campus;
    typeLabelHealth.textContent = currentTabNames.health;
    typeLabelCounseling.textContent = currentTabNames.counseling;
    typeLabelCampusHonor.textContent = currentTabNames.campusHonor;
    typeLabelBook2.textContent = currentTabNames.books;
    typeLabelCampus2.textContent = currentTabNames.campus;
    typeLabelHealth2.textContent = currentTabNames.health;
    typeLabelCounseling2.textContent = currentTabNames.counseling;
    typeLabelCampusHonor2.textContent = currentTabNames.campusHonor;
  }

  async function loadTabVisibility() {
    const t = tabServerOrNull();
    if (!t) { tabApplyStatus("", false); return; }
    try {
      const res = await fetch(`${t.base}/config`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tabs = (data && data.tabs) || {};
      tabChkTv.checked = tabs.tv !== false;
      tabChkBooks.checked = tabs.books !== false;
      tabChkCampus.checked = tabs.campus !== false;
      tabChkHealth.checked = tabs.health !== false;
      tabChkCounseling.checked = tabs.counseling !== false;
      tabChkCampusHonor.checked = tabs.campusHonor !== false;
      /* 分頁標題：有設定就填入，沒設定留空（placeholder 顯示預設值） */
      const tn = (data && data.tabNames) || {};
      tabNameTv.value = tn.tv || "";
      tabNameBooks.value = tn.books || "";
      tabNameCampus.value = tn.campus || "";
      tabNameHealth.value = tn.health || "";
      tabNameCounseling.value = tn.counseling || "";
      tabNameCampusHonor.value = tn.campusHonor || "";
      /* 顯示分頁與類型分類的名稱跟著公告機的標題變動 */
      applyTabNamesToUi(tn);
      tabApplyStatus("已讀取", false);
    } catch (err) {
      tabApplyStatus("讀取失敗：" + err.message, true);
    }
  }

  tabServerSelect.addEventListener("change", () => {
    void loadTabVisibility();
  });
  btnLoadTabs.addEventListener("click", () => {
    void loadTabVisibility();
  });
  btnApplyTabs.addEventListener("click", async () => {
    const t = tabServerOrNull();
    if (!t) { tabApplyStatus("請先選擇公告機", true); return; }
    const tabs = {
      tv: tabChkTv.checked,
      books: tabChkBooks.checked,
      campus: tabChkCampus.checked,
      health: tabChkHealth.checked,
      counseling: tabChkCounseling.checked,
      campusHonor: tabChkCampusHonor.checked,
    };
    /* 分頁標題：去頭尾空白；空白＝沿用預設名稱 */
    const tabNames = {
      tv: tabNameTv.value.trim().slice(0, 20),
      books: tabNameBooks.value.trim().slice(0, 20),
      campus: tabNameCampus.value.trim().slice(0, 20),
      health: tabNameHealth.value.trim().slice(0, 20),
      counseling: tabNameCounseling.value.trim().slice(0, 20),
      campusHonor: tabNameCampusHonor.value.trim().slice(0, 20),
    };
    /* Content-Type 用 text/plain 以避開跨來源預檢請求（伺服器只解析 JSON 內容） */
    try {
      const res = await fetch(`${t.base}/config`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tabs, tabNames }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.ok) {
        applyTabNamesToUi(tabNames);
        tabApplyStatus("已套用，公告機顯示即時更新", false);
      } else throw new Error((data && data.message) || "未知錯誤");
    } catch (err) {
      tabApplyStatus("套用失敗：" + err.message, true);
    }
  });



  /* 填入下拉選單（好書介紹 / 分頁顯示設定） */
  function populateServerSelects() {
    [bookServerSelect, tabServerSelect].forEach((sel) => {
      sel.innerHTML = '<option value="">-- 請選擇公告機 --</option>';
      servers.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.ip}:${s.port})`;
        sel.appendChild(opt);
      });
    });

    if (selectedServerId) {
      bookServerSelect.value = selectedServerId;
      tabServerSelect.value = selectedServerId;
      loadServerInfo(selectedServerId);
      void refreshBookServerStatus(selectedServerId);
      void loadTabVisibility();
    }
  }

  function loadServerInfo(serverId) {
    const s = servers.find((x) => x.id === serverId);
    if (!s) return;
    currentBaseUrl = `http://${s.ip}:${s.port}`;
    bookBtnUpload.disabled = !bookSelectedFiles.length;
  }

  /* ---------- 資料傳輸：選擇公告機時顯示連線狀態 ---------- */
  function setBookServerStatus(text, cls) {
    bookServerStatus.classList.remove("online", "offline");
    if (cls) bookServerStatus.classList.add(cls);
    bookServerStatus.textContent = text;
  }

  /** 檢查公告機是否連線並更新狀態標籤（檢查中→🟢 已連線／🔴 無法連線） */
  async function refreshBookServerStatus(serverId) {
    if (!serverId) {
      setBookServerStatus("", null);
      return;
    }
    setBookServerStatus("連線中…", null);
    const ok = await testConnection(serverId);
    setBookServerStatus(ok ? "🟢 已連線" : "🔴 無法連線", ok ? "online" : "offline");
  }

  /* ---------- 資料傳輸：元素事件 ---------- */
  bookServerSelect.addEventListener("change", (e) => {
    selectedServerId = e.target.value || null;
    if (selectedServerId) {
      loadServerInfo(selectedServerId);
      void refreshBookServerStatus(selectedServerId);
      loadBookList();
    } else {
      currentBaseUrl = "";
      setBookServerStatus("", null);
      bookBtnUpload.disabled = true;
      bookTableBody.innerHTML = "";
      bookListCount.textContent = "0 個檔案";
    }
  });

  bookFileTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateBookTypeUi();
      loadBookList();
    });
  });

  /** 依選擇的類型調整：影片／照片不顯示書名欄位、檔案選擇接受格式 */
  function updateBookTypeUi() {
    const bookType = document.querySelector('input[name="bookFileType"]:checked').value || "book";
    bookTitleRow.classList.toggle("hidden", bookType === "video" || bookType === "image");
    bookFileInput.accept = bookType === "video" ? "video/*" : "image/*";
    /* 切換類型時清除已選檔案，避免誤傳錯誤格式 */
    bookSelectedFiles = [];
    bookFileInput.value = "";
    bookSelectedFile.textContent = "未選擇檔案";
    bookBtnUpload.disabled = !selectedServerId;
    bookMsg.textContent = "";
  }

  bookBtnSelectFile.addEventListener("click", () => bookFileInput.click());
  bookFileInput.addEventListener("change", (e) => {
    const files = Array.from(bookFileInput.files || []);
    if (files.length === 0) return;
    bookSelectedFiles = files;
    const totalMB = (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2);
    const unit = document.querySelector('input[name="bookFileType"]:checked').value === "video" ? "個影片" : "個檔案";
    bookSelectedFile.textContent = `已選擇 ${files.length} ${unit}（共 ${totalMB} MB）`;
    bookBtnUpload.disabled = !selectedServerId;
    bookMsg.textContent = "";
    bookProgress.value = 0;
    bookProgressText.textContent = "0%";
  });

  /** 由檔名取書名顯示（去副檔名、去開頭編號），對應電視牆 books.js 的 titleFromName */
  function bookTitleFromName(name) {
    let t = String(name || "").replace(/\.[^.]+$/, "");
    t = t.replace(/^\d+[\s._-]*/, "");
    return t.trim() || String(name || "").replace(/\.[^.]+$/, "");
  }

  /** 淨化書名成安全的檔名字元（去除 Windows 不允許的字元） */
  function sanitizeBookTitle(t) {
    return String(t || "").replace(/[\\/:*?"<>|\r\n\t]+/g, " ").trim();
  }

  /* 單一檔案上傳到指定伺服器；overrideName 為欲使用的檔名（null = 原檔名） */
  async function uploadSingleFile(file, baseUrl, bookType, overrideName) {
    const uploadName = overrideName || file.name;
    const formData = new FormData();
    formData.append("file", file, uploadName);
    formData.append("type", bookType);

    try {
      const res = await fetch(`${baseUrl}/upload`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error("HTTP " + res.status + (errText ? ": " + errText.slice(0, 200) : ""));
      }
      const result = await res.json();
      const r = (result.results && result.results[0]) || result;
      if (r.ok) {
        return { ok: true, name: r.name || uploadName };
      } else {
        return { ok: false, name: file.name, error: r.error || result.message || "失敗" };
      }
    } catch (err) {
      return { ok: false, name: file.name, error: err.message };
    }
  }

  bookBtnUpload.addEventListener("click", async () => {
    if (bookSelectedFiles.length === 0) return;

    const bookType = document.querySelector('input[name="bookFileType"]:checked').value || "book";
    const title = sanitizeBookTitle(bookTitleInput.value);
    const uploadAll = uploadAllServers.checked;

    if (!uploadAll && !selectedServerId) {
      await alertMsg("請先選擇公告機");
      return;
    }

    if (bookType === "book" && title && bookSelectedFiles.length > 1) {
      bookMsg.textContent = "提示：多張圖片時「標題」不套用，使用原檔名上傳";
      bookMsg.className = "msg";
    }

    /* 好書介紹 + 只選一張圖 + 有填書名 → 以書名當檔名（其餘用原檔名） */
    const overrideName = bookType === "book" && title && bookSelectedFiles.length === 1
      ? title + ((bookSelectedFiles[0].name.match(/\.[^.]+$/) || [""])[0] || ".jpg")
      : null;

    bookMsg.textContent = "上傳中…";
    bookMsg.className = "msg";
    bookProgress.value = 0;
    bookProgressText.textContent = "0%";
    bookBtnUpload.disabled = true;

    let successCount = 0;
    const results = [];

    // 決定要上傳到哪些伺服器
    const targets = uploadAll
      ? servers.filter((s) => s.ip && s.port).map((s) => `http://${s.ip}:${s.port}`)
      : [currentBaseUrl];

    let totalTasks = bookSelectedFiles.length * targets.length;
    let doneTasks = 0;

    for (const file of bookSelectedFiles) {
      for (const baseUrl of targets) {
        const r = await uploadSingleFile(file, baseUrl, bookType, overrideName);
        doneTasks++;
        if (r.ok) {
          successCount++;
          results.push({ ok: true, name: r.name || file.name, server: baseUrl });
        } else {
          results.push({ ok: false, name: file.name, error: r.error || "失敗", server: baseUrl });
        }
        bookProgress.value = Math.round((doneTasks / totalTasks) * 100);
        bookProgressText.textContent = `${bookProgress.value}%`;
      }
    }

    const okList = results.filter((r) => r.ok).map((r) => bookTitleFromName(r.name)).join("、");
    const failList = results.filter((r) => !r.ok).map((r) => `${r.name}（${r.error || "失敗"}）`).join("、");

    if (results.every((r) => r.ok)) {
      bookMsg.textContent = `上傳成功（${successCount} 個檔案）：${okList}`;
      bookMsg.className = "msg success";
    } else if (successCount === 0) {
      bookMsg.textContent = `全部上傳失敗：${failList}`;
      bookMsg.className = "msg error";
    } else {
      bookMsg.textContent = `上傳完成：成功 ${successCount} 個、失敗 ${results.length - successCount} 個\n失敗：${failList}`;
      bookMsg.className = "msg error";
    }

    bookSelectedFiles = [];
    bookFileInput.value = "";
    bookSelectedFile.textContent = "未選擇檔案";
    bookTitleInput.value = "";
    bookBtnUpload.disabled = !selectedServerId;

    loadBookList();
  });

  /* ---------- 檔案清單（表列） ---------- */
  async function loadBookList() {
    if (!currentBaseUrl) {
      bookTableBody.innerHTML = "";
      bookListCount.textContent = "0 個檔案";
      return;
    }
    try {
      const res = await fetch(`${currentBaseUrl}/files`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("無法取得清單 HTTP " + res.status);
      const data = await res.json();

      const bookType = document.querySelector('input[name="bookFileType"]:checked').value || "book";
      /* 伺服器 /files 清單的鍵：video→videos、image→images、book→books */
      const typeKey = bookType === "video" ? "videos" : bookType === "image" ? "images" : bookType === "book" ? "books" : bookType;
      /* 名稱跟著分頁標題（影片／照片固定；book/campus/health/counseling 用公告機設定的名稱） */
      const typeName = bookType === "video" ? "影片" : bookType === "image" ? "照片" : currentTabNames[bookType] || bookType;
      const files = data[typeKey] || [];

      bookListCount.textContent = files.length + " 個檔案";
      bookTableBody.innerHTML = "";

      if (files.length === 0) {
        bookTableBody.innerHTML =
          `<tr><td colspan="5" style="color:#94a3b8;padding:24px;text-align:center;">公告機上沒有${typeName}檔案，請先用上方上傳</td></tr>`;
        return;
      }

      files.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

      files.forEach((f) => {
        const tr = document.createElement("tr");
        /* 影片無縮圖 → 🎬 佔位；影片大小以 MB 顯示 */
        const thumbHtml = bookType === "video"
          ? `<span style="font-size:36px;line-height:64px;">🎬</span>`
          : `<img class="book-thumb" src="${currentBaseUrl}/files/${typeKey}/${encodeURIComponent(f.name)}" alt="" />`;
        const delim = bookType === "video" ? `${(f.size / 1024 / 1024).toFixed(2)} MB` : `${(f.size / 1024).toFixed(0)} KB`;
        tr.innerHTML =
          `<td class="col-thumb">${thumbHtml}</td>` +
          `<td class="col-title">${esc(bookType === "video" ? "影片" : bookType === "image" ? "照片" : bookTitleFromName(f.name))}</td>` +
          `<td class="col-file">${esc(f.name)}</td>` +
          `<td class="col-size">${delim}</td>` +
          `<td class="col-action book-actions"><button data-name="${esc(f.name)}">刪除</button></td>`;
        bookTableBody.appendChild(tr);
      });

      bookTableBody.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const name = btn.getAttribute("data-name");
          if (!(await confirmMsg(`確定要刪除「${name}」嗎？`))) return;
          try {
            const delRes = await fetch(
              `${currentBaseUrl}/files/${typeKey}/${encodeURIComponent(name)}`,
              { method: "DELETE", signal: AbortSignal.timeout(10000) },
            );
            if (!delRes.ok) throw new Error("刪除失敗 HTTP " + delRes.status);
            loadBookList();
          } catch (err) {
            alertMsg("刪除失敗：" + err.message);
          }
        });
      });
    } catch (err) {
      bookTableBody.innerHTML =
        `<tr><td colspan="5" style="color:#f87171;padding:24px;text-align:center;">載入失敗：${esc(err.message)}</td></tr>`;
    }
  }

  bookBtnRefresh.addEventListener("click", loadBookList);

  /* ---------- 測試連線 ---------- */
  async function testConnection(serverId) {
    const s = servers.find((x) => x.id === serverId);
    if (!s) return false;
    const url = `http://${s.ip}:${s.port}`;
    try {
      const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(5000) });
      s.online = res.ok;
      saveServers();
      return res.ok;
    } catch {
      s.online = false;
      saveServers();
      return false;
    }
  }

  /* ---------- 初始化 ---------- */

  /* exe 旁邊的 config.json：提供預設公告機清單
     { "servers": [{ "name": "…", "ip": "…", "port": 8123 }] }
     公告機則是「加入不重複的」。 */
  (async () => {
    try {
      const boot = await tvwallClient.getBootConfig();
      if (boot && boot.raw) {
        console.info("[config.json] 使用設定檔：", boot.path);
        const raw = boot.raw;

        /* 公告機：依 ip+port 去重後併入；已刪除（墓碑）的不復活 */
        let added = 0;
        for (const s of Array.isArray(raw.servers) ? raw.servers : []) {
          if (!s || !s.ip) continue;
          const ip = String(s.ip).trim();
          const port = String(s.port == null ? 8123 : s.port).trim() || "8123";
          if (removedServers.includes(serverAddrKey(ip, port))) continue;
          if (servers.some((x) => x.ip === ip && String(x.port || 8123) === port)) continue;
          servers.push({ id: generateId(), name: s.name ? String(s.name).trim() : ip, ip, port, online: false });
          added++;
        }
        if (added > 0) saveServers();
      }
    } catch (err) {
      console.warn("[config.json] 讀取失敗，使用 localStorage 設定：", err);
    }

    /* 原（無設定檔）初始化流程 */
     /* ---------- 密碼驗證 ---------- */
     await ensurePassword();

    renderServerList();
    populateServerSelects();

    /* 啟動時先套用預設名稱（讀到公告機設定後會再更新） */
    applyTabNamesToUi({});

    if (servers.length > 0 && !selectedServerId) {
      selectedServerId = servers[0].id;
      bookServerSelect.value = selectedServerId;
      loadServerInfo(selectedServerId);
    }

    bookBtnUpload.disabled = true;

    /* 啟動時自動載入資料傳輸檔案清單（已依公告機選擇連動） */
    if (selectedServerId) loadBookList();
  })();
})();
