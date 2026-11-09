/* afterPack：在 NSIS 打包之前，用 rcedit 把 icon.ico 與版本資訊寫進 exe。
   （win.signAndEditExecutable = false 為避開 winCodeSign symlink 權限問題，故補此鉤子） */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RCEDIT = path.join(
  process.env.LOCALAPPDATA || "",
  "electron-builder", "Cache", "winCodeSign", "016611483",
  "rcedit-x64.exe"
);

module.exports = async function afterPack(context) {
  const outDir = context.appOutDir;
  const exe = path.join(outDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, "icon.ico");
  if (!fs.existsSync(RCEDIT)) {
    console.warn(`[afterPack] 找不到 rcedit：${RCEDIT}`);
    return;
  }
  if (!fs.existsSync(exe) || !fs.existsSync(ico)) {
    console.warn(`[afterPack] exe 或 icon 不存在：${exe} / ${ico}`);
    return;
  }
  const appInfo = context.packager.appInfo;
  const version = appInfo.buildVersion || appInfo.version || "1.0.0";
  execFileSync(RCEDIT, [
    exe,
    "--set-icon", ico,
    "--set-version-string", "FileDescription", "電視牆用戶端上傳工具",
    "--set-version-string", "ProductName", "電視牆用戶端上傳工具",
    "--set-file-version", version,
    "--set-product-version", version,
  ], { stdio: "inherit" });
  console.log(`[afterPack] 已寫入圖示與版本資訊：${exe}`);
};
