/* ============================================================
   文庫 · 角色名詞條 (char-terms.js)
   正文中可點出頁邊批注的角色名。純數據＋純函數、零依賴——
   識別邏輯（scanCharTerms）可於 Node 直接測試。
   新人物接入流程見 docs/wenku-margin-note.md：此處加詞條，
   cangyun-data.js 對應人物加 readerNote，即接入完成。
   同名／子串衝突之人工映射俟後續（見文檔待辦）。
   ============================================================ */
export const CHAR_TERMS = [
  { term: "高垣", id: "gaoyuan" },
];

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
