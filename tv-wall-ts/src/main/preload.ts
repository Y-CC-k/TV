import { contextBridge, ipcRenderer } from "electron";

/**
 * 以 contextBridge 暴露最小化的 API 給渲染程序，
 * 渲染程序只能透過 window.tvwall 存取，不會直接碰到 Node／IPC。
 */
const api: TvWallApi = {
  scan: () => ipcRenderer.invoke("scan"),
  config: () => ipcRenderer.invoke("config"),
  close: () => ipcRenderer.invoke("close"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  onSynced: (cb: () => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("synced", listener);
    return () => ipcRenderer.removeListener("synced", listener);
  },
  onConfigUpdated: (cb: (cfg: AppConfig) => void) => {
    const listener = (_e: unknown, cfg: AppConfig): void => cb(cfg);
    ipcRenderer.on("config-updated", listener);
    return () => ipcRenderer.removeListener("config-updated", listener);
  },
};

contextBridge.exposeInMainWorld("tvwall", api);
