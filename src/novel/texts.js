/* ============================================================
   文庫 · 正文文本（懶加載塊 texts.js）
   此檔僅經 index.js 的 loadTexts() 動態 import 觸及，
   故 Vite 將它連同下方 eager 內聯的全部 .txt 切成獨立塊，
   不入首屏主包——正文只在進入文庫閱讀器時才下載。
   鍵為相對 src/novel 的檔名（與 index.js 章節 file 欄一致，如
   "denglou/dingchang.txt"、"shengfeng/m1.txt"）。
   新增正文只建 .txt 並在 index.js 掛 file 即可，此檔無須改動。
   ============================================================ */
const raw = import.meta.glob("./**/*.txt", { query: "?raw", import: "default", eager: true });
export const TEXTS = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k.replace(/^\.\//, ""), v])
);
