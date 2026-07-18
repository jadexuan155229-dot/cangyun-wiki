/* ============================================================
   數據一致性校驗 (scripts/check-data.js)
   校驗 cangyun-data.js 五庫之間的引用完整性——渲染層大量直取
   byId[id].xxx / LOC_COORDS[l]，一個錯 id 即白屏或靜默丟點，
   此處先於瀏覽器把錯攔下。隨 npm run lint 執行；亦可單跑：
     node scripts/check-data.js
   錯誤（exit 1）：會導致崩潰或數據靜默丟失的引用錯。
   警告（exit 0）：可疑但站點尚能運行的問題。
   ============================================================ */
import { fc, CHARACTERS, EVENTS, RELATIONS, LOC_COORDS, TRACK_SUPPLEMENTS } from "../src/cangyun-data.js";

const errors = [];
const warns = [];
const err = (where, msg) => errors.push(`${where}  ${msg}`);
const warn = (where, msg) => warns.push(`${where}  ${msg}`);

/* fc() 對未知門派回退中立灰——以此探測 FACTION_COLORS 未收錄之名 */
const GRAY = fc("__unknown__");
const knownFac = (f) => fc(f) !== GRAY;

/* 事件定位線索：序號 + 年 + 題頭截斷 */
const evTag = (e, i) => `EVENTS[${i}] ${e.year ?? "?"}年「${String(e.title || "").slice(0, 18)}…」`;

/* ---------- 人物 ---------- */
const charIds = new Set();
CHARACTERS.forEach((c, i) => {
  const tag = `CHARACTERS[${i}] ${c.name || c.id || "?"}`;
  if (!c.id) err(tag, "缺 id");
  else if (charIds.has(c.id)) err(tag, `id 重複：${c.id}`);
  else charIds.add(c.id);
  if (!c.name) err(tag, "缺 name");
  if (!Array.isArray(c.belong)) err(tag, "belong 須為數組");
  else for (const f of c.belong) if (!knownFac(f)) warn(tag, `belong 門派「${f}」不在 FACTION_COLORS（將顯中立灰）`);
  if (c.birth != null && c.death != null && c.birth > c.death) err(tag, `生卒倒置：${c.birth} > ${c.death}`);
  for (const y of [c.birth, c.death]) if (y != null && (y < 600 || y > 820)) warn(tag, `生卒年 ${y} 逾常理範圍（600–820），恐系筆誤`);
});

/* ---------- 事件 ---------- */
EVENTS.forEach((e, i) => {
  const tag = evTag(e, i);
  if (typeof e.year !== "number") err(tag, `year 非數字：${e.year}`);
  else if (e.year < 600 || e.year > 820) warn(tag, `year ${e.year} 逾常理範圍（600–820），恐系筆誤`);
  if (e.month != null && (e.month < 1 || e.month > 12)) err(tag, `month 非法：${e.month}`);
  if (!e.title) err(tag, "缺 title");
  if (!Array.isArray(e.chars)) { err(tag, "chars 須為數組"); return; }
  for (const id of e.chars) if (!charIds.has(id)) err(tag, `chars 引用不存在的人物 id：${id}（渲染層 byId[id] 將崩潰）`);
  if (new Set(e.chars).size !== e.chars.length) warn(tag, "chars 有重複 id（共現計數將重複累計）");
  for (const l of e.loc || []) if (!LOC_COORDS[l]) err(tag, `loc「${l}」不在 LOC_COORDS（輿圖將靜默丟點）`);
  for (const f of e.fac || []) if (!knownFac(f)) warn(tag, `fac 門派「${f}」不在 FACTION_COLORS（將顯中立灰）`);
  for (const [id, l] of Object.entries(e.tloc || {})) {
    if (!charIds.has(id)) err(tag, `tloc 鍵引用不存在的人物 id：${id}`);
    else if (!e.chars.includes(id)) err(tag, `tloc 鍵 ${id} 不在本事 chars 中（覆寫無效，恐系錯位）`);
    if (l != null && !LOC_COORDS[l]) err(tag, `tloc 值「${l}」不在 LOC_COORDS`);
  }
});

/* ---------- 關係 ---------- */
RELATIONS.forEach((r, i) => {
  const tag = `RELATIONS[${i}] ${r.a}—${r.b}「${r.t || "?"}」`;
  for (const id of [r.a, r.b]) if (!charIds.has(id)) err(tag, `引用不存在的人物 id：${id}`);
  if (r.a === r.b) err(tag, "a 與 b 同人");
  if (!r.t) err(tag, "缺 t（關係類型）");
  if (r.y0 != null && r.y1 != null && r.y0 > r.y1) err(tag, `年段倒置：y0 ${r.y0} > y1 ${r.y1}`);
});

/* ---------- 動線補點 ---------- */
for (const [id, list] of Object.entries(TRACK_SUPPLEMENTS)) {
  if (!charIds.has(id)) { err(`TRACK_SUPPLEMENTS.${id}`, "鍵引用不存在的人物 id"); continue; }
  list.forEach((s, i) => {
    const tag = `TRACK_SUPPLEMENTS.${id}[${i}]`;
    if (!s.loc || !LOC_COORDS[s.loc]) err(tag, `loc「${s.loc}」不在 LOC_COORDS`);
    if (s.year == null && !s.origin) err(tag, "year 為空而非 origin 起點（體例：year: null 僅限 origin: true）");
    if (s.month != null && (s.month < 1 || s.month > 12)) err(tag, `month 非法：${s.month}`);
  });
}

/* ---------- 地點 ---------- */
const KINDS = new Set(["city", "sect", "region", "off"]);
for (const [name, c] of Object.entries(LOC_COORDS)) {
  const tag = `LOC_COORDS「${name}」`;
  if (!KINDS.has(c.kind)) err(tag, `kind 非法：${c.kind}`);
  if (typeof c.x !== "number" || typeof c.y !== "number") err(tag, "缺 x/y 座標");
  if (c.kind === "off" && c.dir !== "西" && c.dir !== "東") err(tag, `off 條目 dir 須為「西」或「東」：${c.dir}`);
}

/* ---------- 結果 ---------- */
for (const w of warns) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(
  `check-data：人物 ${CHARACTERS.length} · 事件 ${EVENTS.length} · 關係 ${RELATIONS.length} · 地點 ${Object.keys(LOC_COORDS).length} · 補點 ${Object.values(TRACK_SUPPLEMENTS).flat().length} —— ` +
  (errors.length ? `${errors.length} 錯` : "無錯") + (warns.length ? `，${warns.length} 警告` : "")
);
if (errors.length) process.exit(1);
