/* ============================================================
   站內用字掃描 (scripts/font-chars.js)
   汇文明朝、汇文正楷、京华老宋三枚字體只帶 scripts/font-subset-chars.txt
   所列之字（子集），表外之字在三體處回落系統字體。
   本檔掃 src/ 與 index.html 的全部文字，與字符表比對：
     - 直接執行：把站內用到而表中沒有的字補進字符表（只增不刪）
       node scripts/font-chars.js
       ——平常不必單跑，npm run fonts 第一步即此，第二步重裁子集。
     - check-data 引用 missingFontChars() 報缺字警告。
   字符表格式：全部字元去重、按碼位排序後連成一串（含換行符）。
   註釋裡的字也一併收入：多帶幾個字形無害，漏一個則顯形。
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CHAR_LIST = join(ROOT, "scripts", "font-subset-chars.txt");

const SCAN_DIRS = ["src"];
const SCAN_FILES = ["index.html"];
const EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".txt", ".md", ".json"]);

/* ASCII 已全數在表；只收非 ASCII 的基本平面字元，私用區與變體選擇符不收 */
const wanted = (cp) =>
  cp >= 0x80 && cp <= 0xffff && !(cp >= 0xe000 && cp <= 0xf8ff) && !(cp >= 0xfe00 && cp <= 0xfe0f);

const byCodePoint = (a, b) => a.codePointAt(0) - b.codePointAt(0);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

export function siteChars() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [])).concat(SCAN_FILES.map((f) => join(ROOT, f)));
  const set = new Set();
  for (const f of files) for (const ch of readFileSync(f, "utf8")) if (wanted(ch.codePointAt(0))) set.add(ch);
  return set;
}

export function listChars() {
  return new Set(readFileSync(CHAR_LIST, "utf8"));
}

/* 站內用到而字符表沒有的字，按碼位排序 */
export function missingFontChars() {
  const have = listChars();
  return [...siteChars()].filter((c) => !have.has(c)).sort(byCodePoint);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const missing = missingFontChars();
  if (!missing.length) {
    console.log("font-chars：站內用字盡在字符表，無須補字");
  } else {
    const all = [...new Set([...listChars(), ...missing])].sort(byCodePoint);
    writeFileSync(CHAR_LIST, all.join(""));
    console.log(`font-chars：字符表補 ${missing.length} 字（${missing.join("")}），共 ${all.length} 字元`);
  }
}
