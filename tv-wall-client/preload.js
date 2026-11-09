const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tvwallClient", {
  getVersion: () => ipcRenderer.invoke("get-version"),
  /** exe 旁邊的 config.json 內容（沒有則 null）：{ path, raw } */
  getBootConfig: () => ipcRenderer.invoke("get-boot-config"),
  /** 合併寫回 config.json：{ servers: [...] } 或 { honor: {...} }，只動有給的欄位 */
  saveBootConfig: (patch) => ipcRenderer.invoke("save-boot-config", patch),
  /** 無邊框視窗控制 */
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowMaximize: () => ipcRenderer.send("window-maximize"),
  windowClose: () => ipcRenderer.send("window-close"),
});
