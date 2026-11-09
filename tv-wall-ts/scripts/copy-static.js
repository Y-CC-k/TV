// 把靜態檔案（HTML／CSS／JS）複製到 dist/renderer，讓 dist 可獨立執行
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src", "renderer");
const dest = path.join(root, "dist", "renderer");

fs.mkdirSync(dest, { recursive: true });
// index.html 引用的靜態資產（CSS／JS）
for (const file of ["index.html", "style.css", "honor.css", "books.css", "renderer.js", "honor.js", "books.js"]) {
  const from = path.join(src, file);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, file));
}
console.log("已複製靜態檔案到 dist/renderer");
