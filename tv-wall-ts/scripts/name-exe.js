// 打包後把 release\win-unpacked\TvWall.exe 改名為 TvWall-<版本>-<日期時間>.exe
// 目的：每次成品路徑都不同，繞過 Windows 檔案總管以「路徑」索引的圖示快取，
//       確保每次打包都顯示最新的 images.jpg 圖示。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "release", "win-unpacked");
const defaultExe = path.join(dir, "TvWall.exe");

if (!fs.existsSync(dir)) {
  console.warn("找不到 release\\win-unpacked，略過改名");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}`;
const newName = `TvWall-${pkg.version}-${stamp}.exe`;

if (fs.existsSync(defaultExe)) {
  // 清掉上一次改名的舊成品 exe，避免資料夾裡累積
  for (const f of fs.readdirSync(dir)) {
    if (/^TvWall-.+\.exe$/i.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  }
  fs.renameSync(defaultExe, path.join(dir, newName));
  console.log(`執行檔已改名：release\\win-unpacked\\${newName}`);
} else {
  const existing = fs.readdirSync(dir).filter((f) => /^TvWall-.+\.exe$/i.test(f));
  if (existing.length > 0) {
    console.log(`執行檔已是改名後狀態：release\\win-unpacked\\${existing[0]}`);
  } else {
    console.warn("找不到 TvWall.exe，略過改名");
    process.exitCode = 1;
  }
}

// 安裝檔（release\ 底下的 Setup exe）也改成含日期時間的檔名，繞過圖示快取
const releaseDir = path.join(root, "release");
const setupRe = /^TvWall-Setup-\d+(?:\.\d+)*\.exe$/i;
const setupFiles = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((f) => setupRe.test(f))
  : [];
if (setupFiles.length > 0) {
  const dest = path.join(releaseDir, `TvWall-Setup-${pkg.version}-${stamp}.exe`);
  fs.renameSync(path.join(releaseDir, setupFiles[0]), dest);
  console.log(`安裝檔已改名：release\\${path.basename(dest)}`);
}
