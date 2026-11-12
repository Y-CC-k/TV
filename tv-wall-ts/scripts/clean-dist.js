// 建置前先清掉整個 dist，避免上一輪殘留的檔案（例如舊版 sync.js、已刪除的 renderer JS）
// 被 tsc 重新產生並打包進 asar，造成死碼或洩漏。
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
console.log("已清空 dist");
