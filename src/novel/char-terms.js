/* ============================================================
   文庫 · 角色名詞條 (char-terms.js)
   正文中可點出頁邊批注的角色名。詞條以本名自 CHARACTERS 全量
   自動派生（2026-07 全量接入）——新人物入庫即自動可點，
   readerNote 缺者批注卡自動回退官職身份摘要。
   衝突防線：同名（term 重複）由 scripts/check-data.js 報錯攔下，
   屆時以 TERM_EXCLUDE 摘除自動項、另立人工映射；正文誤中
   常語之名（名恰為成詞者）亦以 TERM_EXCLUDE 摘除。
   識別邏輯（scanCharTerms）純函數，可於 Node 直接測試。
   維護流程見 docs/wenku-margin-note.md。
   ============================================================ */
import { CHARACTERS } from "../cangyun-data.js";

const TERM_EXCLUDE = new Set([]); /* 以人物 id 摘除，不參與正文識別 */
export const CHAR_TERMS = CHARACTERS
  .filter((c) => c.name && !TERM_EXCLUDE.has(c.id))
  .map((c) => ({ term: c.name, id: c.id }));

/* 長詞優先序：等位命中時長名先取，短名不吞長名（如有「陆危」「陆危楼」並存，
   「陆危楼」處必識別為三字名） */
const SORTED = [...CHAR_TERMS].sort((a, b) => b.term.length - a.term.length);

/* 掃描純文本段 s：命中則返回段列——{ text } 與 { id, term, at } 相間；無命中返回 null。
   每步取最早命中處，等位取最長（terms 須長度降序，默認 SORTED 已序）。 */
export function scanCharTerms(s, terms = SORTED) {
  const segs = [];
  let at = 0;
  while (at < s.length) {
    let hit = null;
    for (const t of terms) {
      const p = s.indexOf(t.term, at);
      if (p !== -1 && (!hit || p < hit.p)) hit = { p, t }; /* 等位不覆蓋：降序在前者即最長 */
    }
    if (!hit) break;
    if (hit.p > at) segs.push({ text: s.slice(at, hit.p) });
    segs.push({ id: hit.t.id, term: hit.t.term, at: hit.p });
    at = hit.p + hit.t.term.length;
  }
  if (segs.length === 0) return null;
  if (at < s.length) segs.push({ text: s.slice(at) });
  return segs;
}
