/* ============================================================
   哈希路由 (router.js) —— 不引路由庫
   哈希為唯一事實源：頁籤、檔案彈窗、文庫章節均由此派生，
   刷新不丟、鏈接可分享、瀏覽器前進後退可用。
   體例：
     #/<頁籤>            chars / timeline / map / network / community / novel
     #/<頁籤>/<人物id>    非文庫頁籤第二段＝打開的檔案彈窗
     #/novel/<線>/<章>[/<子章>]   文庫章節，同 FLAT 路徑
   未知頁籤回落 chars；文庫路徑不編碼人物（入文庫即收檔案彈窗）。
   ============================================================ */
export const TABS = ["chars", "timeline", "map", "network", "community", "novel"];

export function parseRoute(h) {
  const seg = (h || "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const tab = TABS.includes(seg[0]) ? seg[0] : "chars";
  if (tab === "novel") return { tab, char: null, novelPath: seg.length > 1 ? seg.slice(1).join("/") : null };
  return { tab, char: seg[1] || null, novelPath: null };
}

export function routeHash(r) {
  if (r.tab === "novel") return r.novelPath ? `#/novel/${r.novelPath}` : "#/novel";
  return r.char ? `#/${r.tab}/${r.char}` : `#/${r.tab}`;
}
