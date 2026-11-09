/* afterPack：在 NSIS 打包之前，用 rcedit 把 icon.ico 與版本資訊寫進 exe。
   （win.signAndEditExecutable = false 為避開 winCodeSign symlink 權限問題，故補此鉤子） */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/** 在 electron-builder 的 winCodeSign 快取中尋找 rcedit-x64.exe（跨機器路徑不寫死） */
function findRcedit() {
  const candidates = [];
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "winCodeSign"));
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, "electron-builder", "Cache", "winCodeSign"));
  // 也檢查 node_modules 內可能存在的 rcedit 二進位
  candidates.push(path.join(process.cwd(), "node_modules", "rcedit", "bin"));
  for (const root of candidates) {
    if (!root || !fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.name === "rcedit-x64.exe" || e.name === "rcedit.exe") return full;
      }
    }
  }
  return null;
}

const RCEDIT = findRcedit();

module.exports = async function afterPack(context) {
  const outDir = context.appOutDir;
  const exe = path.join(outDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, "icon.ico");
  if (!RCEDIT) {
    console.warn("[afterPack] 找不到 rcedit，略過寫入 exe 圖示（建置仍可繼續；exe 將使用預設圖示）");
    return;
  }
  if (!fs.existsSync(exe) || !fs.existsSync(ico)) {
    console.warn(`[afterPack] exe 或 icon 不存在：${exe} / ${ico}`);
    return;
  }
  const appInfo = context.packager.appInfo;
  const version = appInfo.buildVersion || appInfo.version || "1.0.0";
  try {
    execFileSync(RCEDIT, [
      exe,
      "--set-icon", ico,
      "--set-version-string", "FileDescription", "電視牆用戶端上傳工具",
      "--set-version-string", "ProductName", "電視牆用戶端上傳工具",
      "--set-file-version", version,
      "--set-product-version", version,
    ], { stdio: "inherit" });
    console.log(`[afterPack] 已寫入圖示與版本資訊：${exe}`);
  } catch (err) {
    console.warn(`[afterPack] rcedit 執行失敗（不影響建置）：${err instanceof Error ? err.message : String(err)}`);
  }
};
