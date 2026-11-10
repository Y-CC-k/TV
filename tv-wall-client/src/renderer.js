(async () => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- 狀態 ---------- */
  let servers = JSON.parse(localStorage.getItem("tvwall_servers") || "[]");
  let selectedServerId = null; // 目前選定的公告機 ID（用於上傳/檔案清單）
  let currentBaseUrl = "";     // 目前選定公告機的 baseUrl
  let selectedFiles = []; // File[] 多個選中的檔案
  let bookSelectedFiles = []; // File[]（好書介紹）多個選中的圖片

  /* ---------- 榮譽榜狀態 ---------- */
  let honorSettings = {
    supabaseUrl: localStorage.getItem("tvwall_honor_supabaseUrl") || "",
    publishableKey: localStorage.getItem("tvwall_honor_publishableKey") || "",
  };

  /* ---------- 元素：大分頁 ---------- */
  const tabTv = $("tabTv");
  const tabBooks = $("tabBooks");
  const tabHonor = $("tabHonor");
  const tabQuery = $("tabQuery");
  const tabSettings = $("tabSettings");
  const panelTv = $("panelTv");
  const panelBooks = $("panelBooks");
  const panelHonor = $("panelHonor");
  const panelQuery = $("panelQuery");
  const panelSettings = $("panelSettings");

  /* ---------- 元素：公告機管理 ---------- */
  const serverName = $("serverName");
  const serverIp = $("serverIp");
  const serverPort = $("serverPort");
  const btnAddServer = $("btnAddServer");
  const serverList = $("serverList");

  /* ---------- 元素：上傳 ---------- */
  const uploadServerSelect = $("uploadServerSelect");
  const uploadFileTypeRadios = document.querySelectorAll('input[name="uploadFileType"]');
  const tvUploadAllServers = $("tvUploadAllServers");
  const uploadBtnSelectFile = $("uploadBtnSelectFile");
  const uploadFileInput = $("uploadFileInput");
  const uploadSelectedFile = $("uploadSelectedFile");
  const uploadBtnUpload = $("uploadBtnUpload");
  const uploadProgress = $("uploadProgress");
  const uploadProgressText = $("uploadProgressText");
  const uploadMsg = $("uploadMsg");

  /* ---------- 元素：好書介紹 ---------- */
  const bookServerSelect = $("bookServerSelect");
  const bookTitleInput = $("bookTitleInput");
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

  /* ---------- 元素：檔案清單 ---------- */
  const filesServerSelect = $("filesServerSelect");
  const filesBtnRefresh = $("filesBtnRefresh");
  const filesListCount = $("filesListCount");
  const filesTableBody = $("filesTableBody");

  /* ---------- 元素：榮譽榜設定 ---------- */
  const honorSupabaseUrl = $("honorSupabaseUrl");
  const honorPublishableKey = $("honorPublishableKey");
  const honorBtnSaveConfig = $("honorBtnSaveConfig");
  const honorConnStatus = $("honorConnStatus");
  const tabServerSelect = $("tabServerSelect");
  const tabChkTv = $("tabChkTv");
  const tabChkHonor = $("tabChkHonor");
  const tabChkBooks = $("tabChkBooks");
  const tabChkCampus = $("tabChkCampus");
  const tabChkHealth = $("tabChkHealth");
  const btnLoadTabs = $("btnLoadTabs");
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
  const honorQueryInput = $("honorQueryInput");
  const honorBtnQuery = $("honorBtnQuery");
  const honorStudentInfo = $("honorStudentInfo");
  const honorStuName = $("honorStuName");
  const honorScoreA = $("honorScoreA");
  const honorScoreB = $("honorScoreB");
  const honorScoreC = $("honorScoreC");
  const honorScoreD = $("honorScoreD");
  const honorQueryMsg = $("honorQueryMsg");

  /* ---------- 元素：學生加分 ---------- */
  const addPointsCardId = $("addPointsCardId");
  const honorBtnAddPoints = $("honorBtnAddPoints");
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
    /* 同步寫回 exe 旁邊的 config.json（只寫 servers 欄位；honor 等其他設定保留） */
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
    [tabTv, tabBooks, tabHonor, tabQuery, tabSettings].forEach((t) => {
      t.classList.remove("tab--active");
      t.setAttribute("aria-selected", "false");
    });
    [panelTv, panelBooks, panelHonor, panelQuery, panelSettings].forEach((p) => p.classList.add("hidden"));
    tab.classList.add("tab--active");
    tab.setAttribute("aria-selected", "true");

    if (tab === tabTv) {
      panelTv.classList.remove("hidden");
    } else if (tab === tabBooks) {
      panelBooks.classList.remove("hidden");
      loadBookList();
    } else if (tab === tabHonor) {
      panelHonor.classList.remove("hidden");
      loadHonorSettingsIntoForm();
      populateClassSelect();
    } else if (tab === tabQuery) {
      panelQuery.classList.remove("hidden");
      loadHonorSettingsIntoForm();
      loadRanking();
    } else if (tab === tabSettings) {
      panelSettings.classList.remove("hidden");
      loadHonorSettingsIntoForm();
    }
  }

  tabTv.addEventListener("click", () => switchTab(tabTv));
  tabBooks.addEventListener("click", () => switchTab(tabBooks));
  tabHonor.addEventListener("click", () => switchTab(tabHonor));
  tabQuery.addEventListener("click", () => switchTab(tabQuery));
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
        saveServers();
      });
    });

    serverList.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!(await confirmMsg("確定要刪除此公告機嗎？"))) return;
        servers = servers.filter((x) => x.id !== id);
        if (selectedServerId === id) {
          selectedServerId = null;
          currentBaseUrl = "";
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

  async function loadTabVisibility() {
    const t = tabServerOrNull();
    if (!t) { tabApplyStatus("", false); return; }
    try {
      const res = await fetch(`${t.base}/config`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tabs = (data && data.tabs) || {};
      tabChkTv.checked = tabs.tv !== false;
      tabChkHonor.checked = tabs.honor !== false;
      tabChkBooks.checked = tabs.books !== false;
      tabChkCampus.checked = tabs.campus !== false;
      tabChkHealth.checked = tabs.health !== false;
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
      honor: tabChkHonor.checked,
      books: tabChkBooks.checked,
      campus: tabChkCampus.checked,
      health: tabChkHealth.checked,
    };
    /* Content-Type 用 text/plain 以避開跨來源預檢請求（伺服器只解析 JSON 內容） */
    try {
      const res = await fetch(`${t.base}/config`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tabs }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.ok) tabApplyStatus("已套用，公告機顯示即時更新", false);
      else throw new Error((data && data.message) || "未知錯誤");
    } catch (err) {
      tabApplyStatus("套用失敗：" + err.message, true);
    }
  });



  /* 填入下拉選單（上傳 / 檔案清單 / 好書介紹 / 分頁顯示設定） */
  function populateServerSelects() {
    [uploadServerSelect, filesServerSelect, bookServerSelect, tabServerSelect].forEach((sel) => {
      sel.innerHTML = '<option value="">-- 請選擇公告機 --</option>';
      servers.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.ip}:${s.port})`;
        sel.appendChild(opt);
      });
    });

    if (selectedServerId) {
      uploadServerSelect.value = selectedServerId;
      filesServerSelect.value = selectedServerId;
      bookServerSelect.value = selectedServerId;
      tabServerSelect.value = selectedServerId;
      loadServerInfo(selectedServerId);
      void loadTabVisibility();
    }
  }

  function loadServerInfo(serverId) {
    const s = servers.find((x) => x.id === serverId);
    if (!s) return;
    currentBaseUrl = `http://${s.ip}:${s.port}`;
    uploadBtnUpload.disabled = !selectedFiles.length;
    bookBtnUpload.disabled = !bookSelectedFiles.length;
  }

  uploadServerSelect.addEventListener("change", (e) => {
    selectedServerId = e.target.value || null;
    if (selectedServerId) {
      loadServerInfo(selectedServerId);
    } else {
      currentBaseUrl = "";
      uploadBtnUpload.disabled = true;
    }
  });

  filesServerSelect.addEventListener("change", (e) => {
    selectedServerId = e.target.value || null;
    if (selectedServerId) {
      loadServerInfo(selectedServerId);
      loadFileList();
    } else {
      currentBaseUrl = "";
      filesTableBody.innerHTML = "";
      filesListCount.textContent = "0 個檔案";
    }
  });

  /* ---------- 好書介紹：元素事件 ---------- */
  bookServerSelect.addEventListener("change", (e) => {
    selectedServerId = e.target.value || null;
    if (selectedServerId) {
      loadServerInfo(selectedServerId);
      loadBookList();
    } else {
      currentBaseUrl = "";
      bookBtnUpload.disabled = true;
      bookTableBody.innerHTML = "";
      bookListCount.textContent = "0 個檔案";
    }
  });

  bookFileTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      loadBookList();
    });
  });

  bookBtnSelectFile.addEventListener("click", () => bookFileInput.click());
  bookFileInput.addEventListener("change", (e) => {
    const files = Array.from(bookFileInput.files || []);
    if (files.length === 0) return;
    bookSelectedFiles = files;
    const totalMB = (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2);
    bookSelectedFile.textContent = `已選擇 ${files.length} 張圖片（共 ${totalMB} MB）`;
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

  /* 單一檔案上傳到指定伺服器 */
  async function uploadSingleFile(file, baseUrl, bookType, title) {
    let uploadName = file.name;
    const ext = (file.name.match(/\.[^.]+$/) || [""])[0];
    if (bookType === "book" && title && uploadName) {
      // 單一檔案且有填書名 → 以書名當檔名
    }
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
      bookMsg.textContent = "提示：多張圖片時「書名」不套用，使用原檔名上傳";
      bookMsg.className = "msg";
    }

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
        const r = await uploadSingleFile(file, baseUrl, bookType, title);
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
    bookSelectedFile.textContent = "未選擇圖片";
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
      const typeKey = bookType === "book" ? "books" : bookType;
      const typeName = bookType === "book" ? "好書介紹" : bookType === "campus" ? "校園風雲" : "衛教宣導";
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
        tr.innerHTML =
          `<td class="col-thumb"><img class="book-thumb" src="${currentBaseUrl}/files/${typeKey}/${encodeURIComponent(f.name)}" alt="" /></td>` +
          `<td class="col-title">${esc(bookTitleFromName(f.name))}</td>` +
          `<td class="col-file">${esc(f.name)}</td>` +
          `<td class="col-size">${(f.size / 1024).toFixed(0)} KB</td>` +
          `<td class="col-action book-actions"><button data-name="${esc(f.name)}">刪除</button></td>`;
        bookTableBody.appendChild(tr);
      });

      bookTableBody.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const name = btn.getAttribute("data-name");
          if (!(await confirmMsg(`確定要刪除「${bookTitleFromName(name)}」嗎？`))) return;
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

  /* ---------- 上傳 ---------- */
  uploadBtnSelectFile.addEventListener("click", () => uploadFileInput.click());
  uploadFileInput.addEventListener("change", (e) => {
    const files = Array.from(uploadFileInput.files || []);
    if (files.length === 0) return;
    selectedFiles = files;
    const totalMB = (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2);
    uploadSelectedFile.textContent = `已選擇 ${files.length} 個檔案（共 ${totalMB} MB）`;
    uploadBtnUpload.disabled = !selectedServerId;
    uploadMsg.textContent = "";
    uploadProgress.value = 0;
    uploadProgressText.textContent = "0%";
  });

  async function uploadFileToServer(file, baseUrl, type) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

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
      if (result.ok && result.results) {
        const r = result.results[0] || {};
        if (r.ok) return { ok: true, name: r.name || file.name };
        else return { ok: false, name: file.name, error: r.error || "失敗" };
      } else {
        return { ok: true, name: result.name || file.name };
      }
    } catch (err) {
      return { ok: false, name: file.name, error: err.message };
    }
  }

  uploadBtnUpload.addEventListener("click", async () => {
    if (selectedFiles.length === 0) return;

    const uploadAll = tvUploadAllServers.checked;
    const type = document.querySelector('input[name="uploadFileType"]:checked').value;

    if (!uploadAll && !selectedServerId) {
      await alertMsg("請先選擇公告機");
      return;
    }

    const targets = uploadAll
      ? servers.filter((s) => s.ip && s.port).map((s) => `http://${s.ip}:${s.port}`)
      : [currentBaseUrl];

    uploadMsg.textContent = "上傳中…";
    uploadMsg.className = "msg";
    uploadProgress.value = 0;
    uploadProgressText.textContent = "0%";
    uploadBtnUpload.disabled = true;

    let successCount = 0;
    let failCount = 0;
    const results = [];
    let doneTasks = 0;
    const totalTasks = selectedFiles.length * targets.length;

    for (const file of selectedFiles) {
      for (const baseUrl of targets) {
        const r = await uploadFileToServer(file, baseUrl, type);
        doneTasks++;
        if (r.ok) {
          successCount++;
          results.push({ ok: true, name: r.name, server: baseUrl });
        } else {
          failCount++;
          results.push({ ok: false, name: r.name, error: r.error || "失敗", server: baseUrl });
        }
        uploadProgress.value = Math.round((doneTasks / totalTasks) * 100);
        uploadProgressText.textContent = `${Math.round((doneTasks / totalTasks) * 100)}%`;
      }
    }

    const okList = results.filter((r) => r.ok).map((r) => r.name).join(", ");
    const failList = results.filter((r) => !r.ok).map((r) => `${r.name}(${r.error || "失敗"})`).join(", ");

    let msg = "";
    if (failCount === 0) {
      msg = `全部上傳成功（${successCount} 個檔案）：${okList}`;
      uploadMsg.className = "msg success";
    } else if (successCount === 0) {
      msg = `全部上傳失敗（${failCount} 個檔案）：${failList}`;
      uploadMsg.className = "msg error";
    } else {
      msg = `上傳完成：成功 ${successCount} 個，失敗 ${failCount} 個\n成功：${okList}\n失敗：${failList}`;
      uploadMsg.className = "msg error";
    }
    uploadMsg.textContent = msg;

    selectedFiles = [];
    uploadFileInput.value = "";
    uploadSelectedFile.textContent = "未選擇檔案";
    uploadBtnUpload.disabled = true;

    setTimeout(() => {
      if (!uploadAll && filesServerSelect.value === selectedServerId) loadFileList();
    }, 1500);
  });

  /* ---------- 檔案清單（表列，與資料傳輸分頁同款） ---------- */
  async function loadFileList() {
    if (!currentBaseUrl) {
      filesTableBody.innerHTML = "";
      filesListCount.textContent = "0 個檔案";
      return;
    }
    try {
      const res = await fetch(`${currentBaseUrl}/files`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("無法取得清單 HTTP " + res.status);
      const data = await res.json();

      const videos = data.videos || [];
      const images = data.images || [];
      const books = data.books || [];
      const campus = data.campus || [];
      const health = data.health || [];
      const allFiles = [...videos, ...images, ...books, ...campus, ...health];

      filesListCount.textContent = allFiles.length + " 個檔案";
      filesTableBody.innerHTML = "";

      const typeNameMap = { video: "影片", image: "照片", book: "好書介紹", campus: "校園風雲", health: "衛教宣導" };

      if (allFiles.length === 0) {
        filesTableBody.innerHTML =
          `<tr><td colspan="5" style="color:#94a3b8;padding:24px;text-align:center;">公告機上沒有檔案，請先用上方上傳</td></tr>`;
        return;
      }

      allFiles.sort((a, b) => {
        if (a.type !== b.type) {
          const order = { video: 0, image: 1, book: 2, campus: 3, health: 4 };
          return (order[a.type] ?? 9) - (order[b.type] ?? 9);
        }
        return a.name.localeCompare(b.name, "zh-Hant");
      });

      for (const f of allFiles) {
        const tr = document.createElement("tr");
        /* 影片無縮圖 → 用 🎬 佔位；其餘皆有圖可當縮圖 */
        const thumbSrc = f.type === "video" ? "" : `${currentBaseUrl}/files/${type2Dir(f.type)}/${encodeURIComponent(f.name)}`;
        const thumbHtml = f.type === "video"
          ? `<span style="font-size:36px;line-height:64px;">🎬</span>`
          : `<img class="book-thumb" src="${thumbSrc}" alt="" />`;
        tr.innerHTML =
          `<td class="col-thumb">${thumbHtml}</td>` +
          `<td class="col-title">${typeNameMap[f.type] || f.type}</td>` +
          `<td class="col-file">${esc(f.name)}</td>` +
          `<td class="col-size">${f.type === "video" ? (f.size / 1024 / 1024).toFixed(2) + " MB" : (f.size / 1024).toFixed(0) + " KB"}</td>` +
          `<td class="col-action book-actions"><button data-type="${f.type}" data-name="${esc(f.name)}">刪除</button></td>`;
        filesTableBody.appendChild(tr);
      }

      filesTableBody.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const type = btn.getAttribute("data-type");
          const name = btn.getAttribute("data-name");
          if (!(await confirmMsg(`確定要刪除「${name}」嗎？`))) return;
          const delType = type === "video" ? "videos" : type === "book" ? "books" : type === "campus" ? "campus" : type === "health" ? "health" : "images";
          try {
            const delRes = await fetch(`${currentBaseUrl}/files/${delType}/${encodeURIComponent(name)}`, {
              method: "DELETE",
              signal: AbortSignal.timeout(10000),
            });
            if (!delRes.ok) throw new Error("刪除失敗 HTTP " + delRes.status);
            loadFileList();
          } catch (err) {
            alertMsg("刪除失敗：" + err.message);
          }
        });
      });
    } catch (err) {
      filesTableBody.innerHTML =
        `<tr><td colspan="5" style="color:#f87171;padding:24px;text-align:center;">載入失敗：${esc(err.message)}</td></tr>`;
    }
  }

  /* type → 伺服器檔案目錄名（API 呼叫用） */
  function type2Dir(type) {
    return type === "video" ? "videos" : type === "book" ? "books" : type === "campus" ? "campus" : type === "health" ? "health" : "images";
  }

  filesBtnRefresh.addEventListener("click", loadFileList);

  /* ---------- 榮譽榜設定 ---------- */
  function loadHonorSettingsIntoForm() {
    honorSupabaseUrl.value = honorSettings.supabaseUrl;
    honorPublishableKey.value = honorSettings.publishableKey;
    updateHonorConnStatus();
  }

  function saveHonorSettings() {
    honorSettings = {
      supabaseUrl: honorSupabaseUrl.value.trim(),
      publishableKey: honorPublishableKey.value.trim(),
    };
    localStorage.setItem("tvwall_honor_supabaseUrl", honorSettings.supabaseUrl);
    localStorage.setItem("tvwall_honor_publishableKey", honorSettings.publishableKey);
    /* 檔案裡的 honor 會覆蓋 UI，這裡同步寫回 config.json，兩邊一致 */
    try {
      const r = tvwallClient.saveBootConfig({ honor: honorSettings });
      r.then((res) => {
        if (res && !res.ok) console.warn("[config.json] 寫入失敗：", res.error);
      });
    } catch (err) {
      console.warn("[config.json] 寫入失敗：", err);
    }
    updateHonorConnStatus();
    honorQueryMsg.textContent = "設定已儲存";
    honorQueryMsg.className = "msg success";
    setTimeout(() => { honorQueryMsg.textContent = ""; }, 2000);
  }

  function updateHonorConnStatus() {
    const hasConfig = !!honorSettings.supabaseUrl && !!honorSettings.publishableKey;
    if (hasConfig) {
      honorConnStatus.textContent = "已設定 Supabase";
      honorConnStatus.className = "status online";
    } else {
      honorConnStatus.textContent = "未設定 Supabase";
      honorConnStatus.className = "status offline";
    }
  }

  /** Supabase RPC 呼叫 */
  async function honorRPC(fn, body) {
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) {
      throw new Error("請先設定 Supabase URL 與 Publishable Key");
    }
    const res = await fetch(`${honorSettings.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: honorSettings.publishableKey,
        Authorization: "Bearer " + honorSettings.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Supabase ${res.status} ${errText.slice(0, 200)}`);
    }
    return res.json();
  }

  /** 顯示學生查詢結果（單列：姓名＋分數） */
  function renderStudentInfo(d) {
    const sp = (d && d.student) || {};
    const rec = (d && d.stu_points) || {};
    honorStuName.textContent = sp.stu_name || "　";
    honorScoreA.textContent = rec.readbook || rec.readBook || "0";
    honorScoreB.textContent = rec.read || "0";
    honorScoreC.textContent = rec.run || "0";
    honorScoreD.textContent = rec.honor || "0";
    honorStudentInfo.style.display = "block";
  }

  function clearStudentInfo() {
    honorStuName.textContent = "　";
    honorScoreA.textContent = "0";
    honorScoreB.textContent = "0";
    honorScoreC.textContent = "0";
    honorScoreD.textContent = "0";
    honorStudentInfo.style.display = "none";
  }

  /** 查詢學生積點 */
  honorBtnQuery.addEventListener("click", async () => {
    const cardId = honorQueryInput.value.trim();
    if (!cardId) {
      honorQueryMsg.textContent = "請輸入卡號或學號";
      honorQueryMsg.className = "msg error";
      return;
    }
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) {
      honorQueryMsg.textContent = "請先設定 Supabase URL 與 Publishable Key";
      honorQueryMsg.className = "msg error";
      return;
    }
    clearStudentInfo();
    honorQueryMsg.textContent = "查詢中…";
    honorQueryMsg.className = "msg";
    try {
      let d = await honorRPC("get_stu_points", { p_card: cardId });
      // PostgREST 對 RETURNS TABLE 的函數回傳陣列，需取出第一筆
      if (Array.isArray(d)) d = d[0] || null;
      if (d && d.student) {
        renderStudentInfo(d);
        honorQueryMsg.textContent = "查詢成功";
        honorQueryMsg.className = "msg success";
      } else {
        honorQueryMsg.textContent = "查無此卡號/學號";
        honorQueryMsg.className = "msg error";
      }
    } catch (err) {
      honorQueryMsg.textContent = "查詢失敗：" + err.message;
      honorQueryMsg.className = "msg error";
    }
  });

  honorQueryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") honorBtnQuery.click();
  });

  /** 儲存 Supabase 設定 */
  honorBtnSaveConfig.addEventListener("click", saveHonorSettings);

  /* ---------- 學生加分（四區 0-5 分） ---------- */

  const addPointItems = ["readBook", "read", "run", "honor"];
  addPointItems.forEach((item) => {
    const slider = $(`addPoints-${item}`);
    const valueSpan = $(`zoneValue-${item}`);
    slider.addEventListener("input", () => {
      valueSpan.textContent = slider.value;
    });
  });

  /** 執行加分 RPC（單一項目） */
  async function honorAddPoints(cardId, item, points) {
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) {
      throw new Error("請先設定 Supabase URL 與 Publishable Key");
    }

    const res = await fetch(`${honorSettings.supabaseUrl}/rest/v1/rpc/add_stu_points`, {
      method: "POST",
      headers: {
        apikey: honorSettings.publishableKey,
        Authorization: "Bearer " + honorSettings.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_card: cardId,
        p_item: item,
        p_points: points,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Supabase ${res.status} ${errText.slice(0, 200)}`);
    }
    return null;
  }

  honorBtnAddPoints.addEventListener("click", async () => {
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) {
      addPointsMsg.textContent = "請先設定 Supabase URL 與 Publishable Key";
      addPointsMsg.className = "msg error";
      return;
    }

    const itemLabels = { readBook: "英文", read: "閱讀", run: "跑步", honor: "榮譽" };
    const toAdd = addPointItems.filter((item) => {
      const v = parseInt($(`addPoints-${item}`).value, 10);
      return v > 0;
    }).map((item) => ({ item, points: parseInt($(`addPoints-${item}`).value, 10) }));

    if (toAdd.length === 0) {
      addPointsMsg.textContent = "請至少選擇一項加分分數（0-5）";
      addPointsMsg.className = "msg error";
      return;
    }

    // 目標學生：以勾選學生為優先，否則使用單筆卡號輸入
    const checkedCards = Array.from(
      classStudentList.querySelectorAll("input[type='checkbox']:checked")
    ).map((cb) => cb.getAttribute("data-card"));
    const cardId = addPointsCardId.value.trim();
    const targets = checkedCards.length > 0 ? checkedCards : (cardId ? [cardId] : []);

    if (targets.length === 0) {
      addPointsMsg.textContent = "請先選擇班級勾選學生，或輸入單筆卡號/學號";
      addPointsMsg.className = "msg error";
      return;
    }

    honorBtnAddPoints.disabled = true;
    addPointsMsg.textContent = `加分中…（共 ${targets.length} 位學生）`;
    addPointsMsg.className = "msg";

    try {
      let okCount = 0;
      const failCards = [];
      for (const card of targets) {
        try {
          for (const { item, points } of toAdd) {
            await honorAddPoints(card, item, points);
          }
          okCount++;
        } catch (err) {
          failCards.push(`${card}（${err.message.slice(0, 80)}）`);
        }
      }

      const detail = toAdd.map((a) => `${itemLabels[a.item]} +${a.points}`).join("、");
      if (failCards.length === 0) {
        addPointsMsg.textContent = `加分成功：${targets.length} 位學生（${detail}）`;
        addPointsMsg.className = "msg success";
      } else {
        addPointsMsg.textContent = `加分完成：成功 ${okCount} 位，失敗 ${failCards.length} 位（${detail}）\n失敗：${failCards.join("、")}`;
        addPointsMsg.className = "msg error";
      }

      // 重設分數與輸入（勾選清除，方便下一輪）
      addPointItems.forEach((item) => {
        $(`addPoints-${item}`).value = 0;
        $(`zoneValue-${item}`).textContent = "0";
      });
      addPointsCardId.value = "";
      if (failCards.length === 0) {
        classStudentList
          .querySelectorAll("input[type='checkbox']")
          .forEach((cb) => (cb.checked = false));
        updateClassSelectedCount();
      }
    } catch (err) {
      addPointsMsg.textContent = "加分失敗：" + err.message;
      addPointsMsg.className = "msg error";
    } finally {
      honorBtnAddPoints.disabled = false;
      if (checkedCards.length === 0) addPointsCardId.focus();
    }
  });

  addPointsCardId.addEventListener("keypress", (e) => {
    if (e.key === "Enter") honorBtnAddPoints.click();
  });

  /* ---------- 學生加分（班級勾選） ---------- */

  let allChecked = false; // 全選/全不選狀態

  /** 班級中文標籤：1年1班 → 一年甲班（類推至 六年癸班） */
  function toClassLabel(grade, cls) {
    const gLabels = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const cLabels = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const g = gLabels[grade - 1] || String(grade);
    const c = cLabels[cls - 1] || String(cls);
    return `${g}年${c}班`;
  }

  /** 由 school_students 取出所有年級班級組合，填入下拉選單 */
  async function populateClassSelect() {
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) return;
    try {
      const res = await fetch(`${honorSettings.supabaseUrl}/rest/v1/school_students?select=grade,class`, {
        headers: {
          apikey: honorSettings.publishableKey,
          Authorization: "Bearer " + honorSettings.publishableKey,
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();

      const map = new Map();
      rows.forEach((r) => map.set(`${r.grade}-${r.class}`, { g: r.grade, c: r.class }));
      const combos = [...map.values()].sort((a, b) => a.g - b.g || a.c - b.c);

      addPointsClassSelect.innerHTML =
        '<option value="">-- 請選擇年級班級 --</option>' +
        combos
          .map(({ g, c }) => `<option value="${g}-${c}">${toClassLabel(g, c)}</option>`)
          .join("");
    } catch (err) {
      addPointsClassSelect.innerHTML = '<option value="">班級載入失敗，請重新切換分頁</option>';
    }
  }

  /** 載入所選班級的學生清單（checkbox 勾選） */
  async function loadClassStudents() {
    const val = addPointsClassSelect.value;
    classStudentList.innerHTML = "";
    allChecked = false;
    btnToggleAllStudents.textContent = "全選";
    classSelectedCount.textContent = "已勾選 0 位學生";
    if (!val) return;

    const [grade, cls] = val.split("-").map(Number);
    classStudentList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:16px;">載入中…</div>';
    try {
      const res = await fetch(
        `${honorSettings.supabaseUrl}/rest/v1/school_students?grade=eq.${grade}&class=eq.${cls}&select=card,name,seat_no&order=seat_no.asc`,
        {
          headers: {
            apikey: honorSettings.publishableKey,
            Authorization: "Bearer " + honorSettings.publishableKey,
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const students = await res.json();

      if (!Array.isArray(students) || students.length === 0) {
        classStudentList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:16px;">此班級查無學生</div>';
        return;
      }

      classStudentList.innerHTML = "";
      students.forEach((st) => {
        const label = document.createElement("label");
        label.className = "stu-check";
        label.innerHTML =
          `<input type="checkbox" data-card="${esc(st.card)}" />` +
          `<span class="stu-name">${esc(st.name)}</span>` +
          `<span class="stu-card">${esc(st.card)}</span>`;
        label.addEventListener("click", (e) => {
          if (e.target !== label) return;
          const cb = label.querySelector("input");
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        });
        classStudentList.appendChild(label);
      });
    } catch (err) {
      classStudentList.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#f87171;padding:16px;">載入失敗：${esc(err.message)}</div>`;
    }
  }

  /** 更新勾選人數顯示 */
  function updateClassSelectedCount() {
    const n = classStudentList.querySelectorAll("input[type='checkbox']:checked").length;
    classSelectedCount.textContent = `已勾選 ${n} 位學生`;
  }

  addPointsClassSelect.addEventListener("change", loadClassStudents);

  // 勾選狀態 → 高亮 ＋ 計數
  classStudentList.addEventListener("change", (e) => {
    if (e.target && e.target.type === "checkbox") {
      e.target.closest(".stu-check").classList.toggle("checked", e.target.checked);
      updateClassSelectedCount();
    }
  });

  // 全選 / 全不選
  btnToggleAllStudents.addEventListener("click", () => {
    const boxes = classStudentList.querySelectorAll("input[type='checkbox']");
    if (boxes.length === 0) return;
    allChecked = !allChecked;
    boxes.forEach((cb) => {
      cb.checked = allChecked;
      cb.closest(".stu-check").classList.toggle("checked", allChecked);
    });
    btnToggleAllStudents.textContent = allChecked ? "全不選" : "全選";
    updateClassSelectedCount();
  });

  /* ---------- 元素：積點查詢排行榜 ---------- */
  const rankModeSelect = $("rankModeSelect");
  const rankItemSelect = $("rankItemSelect");
  const rankBtnLoad = $("rankBtnLoad");
  const rankResultWrap = $("rankResultWrap");
  const rankTbody = $("rankTbody");
  const rankMsg = $("rankMsg");

  /** 載入排行榜（總排/月排 × 四項目） */
  async function loadRanking() {
    if (!honorSettings.supabaseUrl || !honorSettings.publishableKey) {
      rankMsg.textContent = "請先在「⚙️ 全部設置」設定 Supabase";
      rankMsg.className = "msg error";
      rankResultWrap.style.display = "none";
      return;
    }
    const label = { readBook: "英文", read: "閱讀", run: "跑步", honor: "榮譽" }[rankItemSelect.value];
    rankMsg.textContent = (rankModeSelect.value === "monthly" ? "月排行" : "總排行") + "（" + label + "）載入中…";
    rankMsg.className = "msg";
    try {
      const fn = rankModeSelect.value === "monthly" ? "get_monthly_ranking" : "get_total_ranking";
      let rows = await honorRPC(fn, { p_item: rankItemSelect.value, p_limit: 15 });
      if (Array.isArray(rows)) rows = rows[0] === undefined ? [] : rows;
      rows = Array.isArray(rows) ? rows : [];

      rankTbody.innerHTML = "";
      rankResultWrap.style.display = "block";
      rankMsg.textContent = (rankModeSelect.value === "monthly" ? "月排行" : "總排行") + "（" + label + "）";
      rankMsg.className = "msg success";

      if (rows.length === 0) {
        rankTbody.innerHTML = '<tr><td colspan="5" style="color:#94a3b8">查無資料</td></tr>';
        return;
      }

      rows.forEach((r, i) => {
        const rank = i + 1;
        const tr = document.createElement("tr");
        tr.innerHTML =
          `<td>${rank === 1 ? "🥇 " : rank === 2 ? "🥈 " : rank === 3 ? "🥉 " : ""}${rank}</td>` +
          `<td>${esc(r.card)}</td>` +
          `<td>${esc(r.name)}</td>` +
          `<td>${esc(toClassLabel(r.grade, r.class))}</td>` +
          `<td class="pts">${esc(r.points == null ? 0 : r.points)}</td>`;
        rankTbody.appendChild(tr);
      });
    } catch (err) {
      rankResultWrap.style.display = "none";
      rankMsg.textContent = "排行榜載入失敗：" + err.message;
      rankMsg.className = "msg error";
    }
  }

  // 下拉選單切換即自動載入
  rankModeSelect.addEventListener("change", loadRanking);
  rankItemSelect.addEventListener("change", loadRanking);
  rankBtnLoad.addEventListener("click", loadRanking);

  /* ---------- 初始化 ---------- */

  /* exe 旁邊的 config.json：提供預設公告機清單與積點排行 Supabase 設定
     { "servers": [{ "name": "…", "ip": "…", "port": 8123 }],
       "honor":   { "supabaseUrl": "…", "publishableKey": "…" } }
     檔案內的 honor 設定優先於 UI／localStorage；公告機則是「加入不重複的」。 */
  (async () => {
    try {
      const boot = await tvwallClient.getBootConfig();
      if (boot && boot.raw) {
        console.info("[config.json] 使用設定檔：", boot.path);
        const raw = boot.raw;

        /* 公告機：依 ip+port 去重後併入 */
        let added = 0;
        for (const s of Array.isArray(raw.servers) ? raw.servers : []) {
          if (!s || !s.ip) continue;
          const ip = String(s.ip).trim();
          const port = String(s.port == null ? 8123 : s.port).trim() || "8123";
          if (servers.some((x) => x.ip === ip && String(x.port || 8123) === port)) continue;
          servers.push({ id: generateId(), name: s.name ? String(s.name).trim() : ip, ip, port, online: false });
          added++;
        }
        if (added > 0) saveServers();

        /* 積點排行：檔案有值時以檔案為準 */
        const honor = raw.honor || {};
        if (honor.supabaseUrl && honor.publishableKey) {
          honorSettings.supabaseUrl = String(honor.supabaseUrl);
          honorSettings.publishableKey = String(honor.publishableKey);
          localStorage.setItem("tvwall_honor_supabaseUrl", honorSettings.supabaseUrl);
          localStorage.setItem("tvwall_honor_publishableKey", honorSettings.publishableKey);
        }
      }
    } catch (err) {
      console.warn("[config.json] 讀取失敗，使用 localStorage 設定：", err);
    }

    /* 原（無設定檔）初始化流程 */
     /* ---------- 密碼驗證 ---------- */
     await ensurePassword();

    renderServerList();
    populateServerSelects();
    loadHonorSettingsIntoForm();

    if (servers.length > 0 && !selectedServerId) {
      selectedServerId = servers[0].id;
      uploadServerSelect.value = selectedServerId;
      filesServerSelect.value = selectedServerId;
      loadServerInfo(selectedServerId);
    }

    uploadBtnUpload.disabled = true;
  })();
})();
