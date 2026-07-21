import { useState, useMemo, useEffect, useRef } from "react";
import { fc, CHARACTERS, EVENTS, RELATIONS, LOC_COORDS, TRACK_SUPPLEMENTS, GEO_BASE } from "./cangyun-data";
import { serif, T, useNarrow, useCoarsePointer } from "./theme";
import { parseRoute, routeHash } from "./router";
import { FLAT } from "./novel";
import NOVEL_MENTIONS from "virtual:novel-mentions";
import { SEAL_SVG_FILE } from "./seals";
import NovelReader from "./novel-reader";

/* ============================================================
   蒼雲 · 人山人海 檔案 — 可視化站點原型 v4
   題頭體例：名·字 — 別號 — 四字概覽 — 一字品評 — 訓詁
   檔案八目：官职身份 / 体貌特征 / 性格 / 偶像 / 武学 /
             随身物件 / 喜好 / 专擅 —— 有明文者依原文，
             敘事體者由行文提煉，無可考者留目而空。
   生卒、出身、門派、事件繫年悉依 Notion 兩庫。
   ============================================================ */

const TYPE_GROUP = [
  [["授业", "传功", "问对"], "#7FB0D8"],
  [["遗承"], "#9B7EC8"],
  [["伴侣", "夫妻", "有情", "私情", "倾慕"], "#D88BA8"],
  [["亲缘"], "#B08968"],
  [["杀伐"], "#C05050"],
  [["嫌隙"], "#C8B45A"],
  [["未遂", "未说开", "未见"], "#8B94A0"],
  [["恩义", "知遇", "知契", "荐引", "救援", "收留", "照护", "代护", "调停", "受托", "医患", "同盟", "宽宥"], "#C9A15C"],
];
function relColor(t) {
  const first = t.split("·")[0];
  for (const [ks, c] of TYPE_GROUP) if (ks.includes(first)) return c;
  return "#7FA980";
}
function relActive(r, Y) {
  return (r.y0 == null || r.y0 <= Y) && (r.y1 == null || Y <= r.y1 || r.ph);
}
function relPosthumous(r, Y) {
  return !!r.ph && r.y1 != null && Y > r.y1;
}

const CENTERS_META = [
  { id: "minfangcheng", tag: "蒼雲線" },
  { id: "chengkai", tag: "天策線" },
];
const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
const sortEvents = (a, b) =>
  a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.seq ?? "").localeCompare(b.seq ?? "");

const CN = ["", "元", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十"];
const CN_MONTH = ["", "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
/* 年號紀年：體例遵庫中原文（「至德二年」「天宝四年」「开元二十六年」），用「年」不用「载」 */
function eraOf(y) {
  if (y == null) return "";
  /* 713 前仅收录站内所需诸年（651—679 波斯史实线；680 陆危楼生、700 宣康生、702 朗迪恩生、707 立明教／陆南信生）。
     按：674 上元元年为高宗年号，与肃宗上元（760）同号异代，eraOf 逐年返回，两不相扰。 */
  const EARLY = { 651: "永徽二年", 654: "永徽五年", 661: "龙朔元年", 663: "龙朔三年", 674: "上元元年", 678: "仪凤三年", 679: "调露元年", 680: "永隆元年", 700: "久视元年", 702: "长安二年", 705: "神龙元年", 707: "景龙元年", 708: "景龙二年", 710: "景云元年" };
  if (EARLY[y]) return EARLY[y];
  if (y >= 713 && y <= 741) return `开元${CN[y - 712]}年`;
  if (y >= 742 && y <= 756) return `天宝${CN[y - 741]}年`;
  if (y === 757) return "至德二年";
  if (y === 758) return "乾元元年";
  if (y === 759) return "乾元二年";
  if (y === 760) return "上元元年";
  if (y === 761) return "上元二年";
  if (y === 762) return "宝应元年";
  if (y === 763) return "宝应二年";
  if (y === 764) return "广德二年";
  if (y === 765) return "永泰元年";
  if (y >= 766 && y <= 779) return `大历${CN[y - 765]}年`;
  if (y >= 780 && y <= 783) return `建中${CN[y - 779]}年`;
  if (y === 784) return "兴元元年";
  if (y >= 785 && y <= 805) return `贞元${CN[y - 784]}年`;
  return "";
}
/* 年中改元者附注 */
const ERA_NOTES = { 756: "七月改元至德", 758: "二月改元乾元", 760: "闰四月改元上元", 762: "四月改元宝应", 763: "七月改元广德" };

function lifespan(c) {
  if (c.birth == null && c.death == null) return "生卒待补";
  const b = c.birth != null ? `${c.birth}（${eraOf(c.birth)}）` : "？";
  const d = c.death != null ? `${c.death}（${eraOf(c.death)}）` : "";
  return `${b} — ${d}`;
}
function coCountsFor(centerId) {
  const n = {};
  for (const e of EVENTS) {
    if (!e.chars.includes(centerId)) continue;
    for (const id of e.chars) if (id !== centerId) n[id] = (n[id] || 0) + 1;
  }
  return n;
}

/* 紅泥方印：一字品評（印泥肌理與邊緣缺口見 index.css .seal-stamp）
   字形方案："a" 宋系收細版；"b" 輕隸意版（.seal-stamp--li） */
const SEAL_FONT_VARIANT = "b";
/* 筆畫繁複、小印中偏擠的字：dense 狀態下字形再縮約 5% */
const SEAL_DENSE_CH = new Set(["峭", "霸", "敏", "逸", "健"]);
/* 改用 SVG 印章的人物見 seals.js。紅面僅佔 viewBox 約 87%，四邊各留約 6.5% 透明邊，
   故放大係數把紅面還原到與文字印章外框相當；
   大印按等高換算約需 1.15，實看偏輕故加大到 1.20；NUDGE_Y 為視覺中心微調 */
const SEAL_SVG_SCALE = { sm: 1.15, lg: 1.2 };
const SEAL_SVG_NUDGE_Y = 1;
function Seal({ ch, size = 15, svg }) {
  if (!ch) return null;
  const sm = size < 18;
  /* 小印字縮一成（繁複字再縮 5%）、橫向補回內邊距，外框尺寸不變；豎向由外層行高撐住 */
  const chScale = sm ? (SEAL_DENSE_CH.has(ch) ? 0.855 : 0.9) : 1;
  /* 兩種印章共用這一套盒模型：外框尺寸與基線位置由字號、行高、內邊距決定 */
  const box = {
    fontSize: size,
    padding: `${Math.round(size * 0.18)}px ${Math.round(size * 0.3) + (size * (1 - chScale)) / 2}px`,
    lineHeight: 1, display: "inline-block",
  };
  /* SVG 印章：外殼用同一 box 加一枚隱藏字撐出等寬、等高、等基線的占位盒，
     不套 .seal-stamp 的紅底／肌理／缺口；img 絕對定位鋪滿，縮放不參與排版 */
  if (svg) {
    return (
      <span className="seal-svg-shell" style={box} title="品评">
        <span style={{ fontSize: `${chScale}em`, visibility: "hidden" }}>{ch}</span>
        <img className="seal-svg" src={`${import.meta.env.BASE_URL}images/seals/${svg}`} alt=""
          style={{ transform: `translateY(${SEAL_SVG_NUDGE_Y}px) scale(${sm ? SEAL_SVG_SCALE.sm : SEAL_SVG_SCALE.lg})` }} />
      </span>
    );
  }
  return (
    <span className={SEAL_FONT_VARIANT === "b" ? "seal-stamp seal-stamp--li" : "seal-stamp"}
      data-size={sm ? "sm" : "lg"} style={{
      ...box, color: "#E7E2D6", backgroundColor: T.seal,
    }} title="品评"><span className="seal-stamp-ch" style={{ fontSize: `${chScale}em` }}>{ch}</span></span>
  );
}

/* ---------------- 檔案卡 ---------------- */
function CharCard({ c, onOpen }) {
  const main = c.belong[0];
  const evCount = EVENTS.filter((e) => e.chars.includes(c.id)).length;
  return (
    <div
      onClick={() => onOpen(c)}
      className="cursor-pointer flex"
      style={{ background: T.panel, border: `1px solid ${T.line}`, borderTop: `3px solid ${fc(main)}`, padding: "16px 14px 14px 16px", gap: 12, transition: "background .15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.panelHi)}
      onMouseLeave={(e) => (e.currentTarget.style.background = T.panel)}
    >
      <div style={{ writingMode: "vertical-rl", fontFamily: serif, fontSize: 12, letterSpacing: "0.35em", color: T.faint, borderRight: `1px solid ${T.line}`, paddingRight: 8, minHeight: 88 }}>
        {c.zi ? `字 ${c.zi}` : "字号待补"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-baseline flex-wrap" style={{ gap: 10 }}>
          <span style={{ fontFamily: serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>{c.name}</span>
          {evCount > 0 && <span style={{ fontSize: 11, color: T.faint }}>繫年 {evCount} 事</span>}
          <Seal ch={c.pin} size={15} svg={SEAL_SVG_FILE[c.id]} />
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          {lifespan(c)}
          {c.birthplace && <><span style={{ margin: "0 8px", color: T.faint }}>·</span>{c.birthplace}</>}
        </div>
        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }}>
          {(c.belong.length ? c.belong : ["门派待补"]).map((f) => (
            <span key={f} style={{ fontSize: 11, color: fc(f), border: `1px solid ${fc(f)}55`, padding: "1px 7px", borderRadius: "3px" }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 詳情面板 ---------------- */
/* 門派色 → 滾動條次級用色：向通道均值靠攏（灰化）再整體壓暗，輸出 rgba。
   grayT 灰化比、darkT 壓暗比、alpha 透明度；供檔案彈窗 thumb / thumb:hover 派生 */
function dimAccent(hex, grayT, darkT, alpha) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const avg = (ch[0] + ch[1] + ch[2]) / 3;
  const [r, g, b] = ch.map((v) => Math.round((v + (avg - v) * grayT) * (1 - darkT)));
  return `rgba(${r},${g},${b},${alpha})`;
}

function DetailPanel({ c, onClose, onOpenChar, onOpenNovel }) {
  const [showAll, setShowAll] = useState(false);
  /* Esc 關閉：與文庫批注卡對齊；hook 須居早退之前，開啟時方掛監聽 */
  useEffect(() => {
    if (!c) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, onClose]);
  /* 見於文庫：正文以本名精確計數（表字、別號短而易誤中，不入檢索）；
     僅列有命中之章。計數於構建期預算（見 vite.config.js 之 virtual:novel-mentions），
     故正文已切為懶加載塊、不入主包，此面板仍不需拉正文即秒出。
     按「線（·卷）」聚合為可展開塊——屬卷之章歸【線·卷】，散章歸【線】，
     同線可並出兩塊（卷與散章於目錄本同級）；塊上僅標章數，處數在章 chip */
  const mentionGroups = useMemo(() => {
    if (!c) return [];
    const groups = [];
    const byKey = {};
    for (const f of FLAT) {
      const n = (NOVEL_MENTIONS[f.ch.file] || {})[c.id] || 0;
      if (n === 0) continue;
      const key = f.group ? `${f.novel.id}/${f.group.id}` : f.novel.id;
      if (!byKey[key]) {
        byKey[key] = { key, label: f.group ? `${f.novel.tag}·${f.group.title}` : f.novel.tag, chapters: [] };
        groups.push(byKey[key]);
      }
      byKey[key].chapters.push({ f, n });
    }
    return groups;
  }, [c]);
  /* 塊展開態：可多開，默認全收；換人自動全收 */
  const [openGroups, setOpenGroups] = useState(() => new Set());
  useEffect(() => { setOpenGroups(new Set()); }, [c]);
  const toggleGroup = (k) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  if (!c) return null;
  const related = EVENTS.filter((e) => e.chars.includes(c.id)).sort(sortEvents);
  const co = {};
  for (const e of related) for (const id of e.chars) if (id !== c.id) co[id] = (co[id] || 0) + 1;
  const coList = Object.entries(co).sort((a, b) => b[1] - a[1]);
  const anecdotes = c.anecdotes || [];
  const shownAnecdotes = showAll ? anecdotes : anecdotes.slice(0, 4);
  /* 檔案彈窗強調色：隨人物門派色動態派生（訓詁豎線、高光框、軼事圓點、滾動條）。
     已啟用：天策、明教、霸刀、長歌、凌雪閣、萬花、七秀、純陽、丐幫、蓬萊、藏劍、唐門、五毒、
     少林、藥宗、衍天宗、萬靈、段氏、平民（判序從門派底紋 factionMark 之先後，雙屬者取先者；
     平民不入底紋鏈，殿於末位，俟其正屬門派啟用即自讓位）；
     奚人/狼牙、南詔亦不入底紋鏈，同置末段。id 特判（仿底紋鏈嵐川雲、盧秉毓之體例，悉依作者定色）：
     朗迪恩（西域·平民雙標籤）、魯雅從西域；程釗、程鐸從唐軍（程鋒、程宇乃天策·唐軍雙屬，
     今從天策，故唐軍不整體入鏈）；
     未啟用者維持全站橘紅與原滾動條紅棕，後續門派擴此判斷即可 */
  const profileFaction = ["langdien", "luya"].includes(c.id) ? "西域"
    : ["chengzhao", "chengduo"].includes(c.id) ? "唐军"
    : c.belong.includes("天策") ? "天策"
    : c.belong.includes("明教") ? "明教"
    : c.belong.includes("霸刀") ? "霸刀"
    : c.belong.includes("长歌") ? "长歌"
    : c.belong.includes("凌雪阁") ? "凌雪阁"
    : c.belong.includes("万花") ? "万花"
    : c.belong.includes("七秀") ? "七秀"
    : c.belong.includes("纯阳") ? "纯阳"
    : c.belong.includes("丐帮") ? "丐帮"
    : c.belong.includes("蓬莱") ? "蓬莱"
    : c.belong.includes("藏剑") ? "藏剑"
    : c.belong.includes("唐门") ? "唐门"
    : c.belong.includes("五毒") ? "五毒"
    : c.belong.includes("少林") ? "少林"
    : c.belong.includes("药宗") ? "药宗"
    : c.belong.includes("衍天宗") ? "衍天宗"
    : c.belong.includes("万灵") ? "万灵"
    : c.belong.includes("段氏") ? "段氏"
    : c.belong.includes("奚人/狼牙") ? "奚人/狼牙"
    : c.belong.includes("南诏") ? "南诏"
    : c.belong.includes("平民") ? "平民" : null;
  /* 蒼雲例外（作者定則）：僅滾動條（thumb/箭頭）隨門派鐵灰，文內強調（訓詁豎線、高光框、
     軼事圓點）維持全站橘紅——故滾動條色自 scrollFaction 派生，與 profileFaction 解耦；
     判定沿用底紋鏈之嵐川雲、盧秉毓排除 */
  const scrollFaction = profileFaction
    || (c.belong.includes("苍云") && !["lanchuanyun", "lubingyu"].includes(c.id) ? "苍云" : null);
  const profileAccent = profileFaction ? fc(profileFaction) : T.accent;
  const profileAccentSoft = scrollFaction ? dimAccent(fc(scrollFaction), 0.4, 0.25, 0.62) : "rgba(126,78,76,0.62)";
  const profileAccentHover = scrollFaction ? dimAccent(fc(scrollFaction), 0.35, 0.08, 0.82) : "rgba(158,91,86,0.82)";
  // 門派底紋：從屬蒼雲者顯示蒼雲紋（嵐川雲、盧秉毓雙屬他派，按設定除外），
  // 從屬天策、明教、霸刀、長歌、凌雪閣、萬花、七秀者顯示各自紋樣；
  // 同一詳情卡僅取一種，其餘門派暫無底紋
  const factionMark = c.id === "cenquan" ? "cenquan"
    : c.belong.includes("苍云") && !["lanchuanyun", "lubingyu"].includes(c.id) ? "cangyun"
    : c.belong.includes("天策") ? "tiance"
    : c.belong.includes("明教") ? "mingjiao"
    : c.belong.includes("霸刀") ? "badao"
    : c.belong.includes("长歌") ? "changge"
    : c.belong.includes("凌雪阁") ? "lingxuege"
    : c.belong.includes("万花") ? "wanhua"
    : c.belong.includes("七秀") ? "qixiu"
    : c.belong.includes("纯阳") ? "chunyang"
    : c.belong.includes("丐帮") ? "gaibang"
    : c.belong.includes("蓬莱") ? "penglai"
    : c.belong.includes("藏剑") ? "cangjian"
    : c.belong.includes("唐门") ? "tangmen"
    : c.belong.includes("五毒") ? "wudu"
    : c.belong.includes("少林") ? "shaolin"
    : c.belong.includes("药宗") ? "yaozong"
    : c.belong.includes("衍天宗") ? "yantianzong"
    : c.belong.includes("万灵") ? "wanling"
    : c.belong.includes("段氏") ? "duanshi"
    : c.belong.includes("唐军") ? "tangjun" : null;

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 12, letterSpacing: "0.3em", color: T.faint, marginBottom: 8 }}>{children}</div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(10,12,15,.72)", zIndex: 50, padding: 20 }} onClick={() => { setShowAll(false); onClose(); }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.panel, border: `1px solid ${T.line}`, maxWidth: 700, width: "100%", maxHeight: "86vh", position: "relative", overflow: "hidden", isolation: "isolate", display: "flex", flexDirection: "column" }}>
        {factionMark && (
          <div className={`faction-watermark faction-watermark--${factionMark}`} aria-hidden="true">
            {/* 藥宗自定義灰度：feColorMatrix 藍通道負權重，使黃（低藍）亮於白（高藍），
                中心層次得以翻轉；外圍翠綠/淺綠相對關係不變。CSS 濾鏡無法做到跨色相翻轉 */}
            {factionMark === "yaozong" && (
              <svg width="0" height="0" style={{ position: "absolute" }}>
                <filter id="yaozong-tone" colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values="0.6 0.5 -0.5 0 0.2  0.6 0.5 -0.5 0 0.2  0.6 0.5 -0.5 0 0.2  0 0 0 1 0" />
                </filter>
              </svg>
            )}
          </div>
        )}
        <div className="char-modal-scroll" style={{ overflowY: "auto", minHeight: 0, padding: "28px 32px 32px", position: "relative", zIndex: 1, "--profile-accent": profileAccent, "--profile-accent-soft": profileAccentSoft, "--profile-accent-hover": profileAccentHover }}>
        {/* 人物檔案彈窗縱向滾動條深色化：僅作用於 .char-modal-scroll，不及全站；
            thumb 取門派派生色（--profile-accent-soft/hover，自容器內聯變量注入），track 維持深灰透明 */}
        <style>{`
.char-modal-scroll{scrollbar-width:thin;scrollbar-color:var(--profile-accent-soft) rgba(255,255,255,0.035)}
.char-modal-scroll::-webkit-scrollbar{width:8px}
.char-modal-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.035)}
.char-modal-scroll::-webkit-scrollbar-thumb{background:var(--profile-accent-soft);border-radius:4px}
.char-modal-scroll::-webkit-scrollbar-thumb:hover{background:var(--profile-accent-hover)}
.char-modal-scroll::-webkit-scrollbar-button{background:var(--profile-accent-soft)}/* 僅著色：不設尺寸，環境無箭頭時此規則自然無效 */
`}</style>
        {c.pin && <div style={{ position: "absolute", top: 26, right: 60 }}><Seal ch={c.pin} size={22} svg={SEAL_SVG_FILE[c.id]} /></div>}
        <button onClick={() => { setShowAll(false); onClose(); }} style={{ position: "absolute", top: 20, right: 22, color: T.muted, fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>×</button>

        <div className="flex items-baseline flex-wrap" style={{ gap: 12, paddingRight: 70 }}>
          <span style={{ fontFamily: serif, fontSize: 30, color: T.ink, fontWeight: 700 }}>{c.name}</span>
          {c.zi && <span style={{ fontFamily: serif, fontSize: 15, color: T.muted }}>字 {c.zi}</span>}
          {c.hao && <span style={{ fontFamily: serif, fontSize: 13, color: T.faint }}>「{c.hao}」</span>}
        </div>
        {c.epithet && (
          <div style={{ fontFamily: serif, fontSize: 16, color: T.ink, letterSpacing: "0.5em", marginTop: 10, paddingBottom: 10, borderBottom: `1px solid ${T.line}`, display: "inline-block", paddingRight: 24 }}>
            {c.epithet}
          </div>
        )}
        <div style={{ fontSize: 13, color: T.muted, marginTop: 10 }}>
          {lifespan(c)} {c.birthplace && `· ${c.birthplace}`}
        </div>
        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
          {(c.belong.length ? c.belong : ["门派待补"]).map((f) => (
            <span key={f} style={{ fontSize: 11, color: fc(f), border: `1px solid ${fc(f)}55`, padding: "1px 7px", borderRadius: "3px" }}>{f}</span>
          ))}
        </div>

        {c.gloss && (
          /* 有門派底紋的人物：訓詁塊半透明底（alpha 0.58），讓底層紋樣連續透出；其餘人物維持不透明 */
          <div style={{ marginTop: 22, borderLeft: `2px solid ${profileAccent}`, background: factionMark ? `${T.panelHi}94` : T.panelHi, padding: "12px 16px" }}>
            <SectionLabel>名字訓詁</SectionLabel>
            <div style={{ fontFamily: serif, fontSize: 13.5, color: T.muted, lineHeight: 2.05 }}>{c.gloss}</div>
          </div>
        )}

        {c.profile && (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>檔案</SectionLabel>
            {c.profile.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14, padding: "7px 0", borderBottom: `1px solid ${T.line}44` }}>
                <div style={{ minWidth: 68, fontSize: 12, letterSpacing: "0.12em", color: T.faint, fontFamily: serif, paddingTop: 3 }}>{k}</div>
                <div style={{ flex: 1, fontFamily: serif, fontSize: 14, color: v ? T.ink : T.faint, lineHeight: 1.9, minHeight: 20 }}>{v || ""}</div>
              </div>
            ))}
          </div>
        )}

        {anecdotes.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>個人軼事</SectionLabel>
            {shownAnecdotes.map((a, i) => (
              <p key={i} style={{ fontFamily: serif, fontSize: 14, color: T.ink, lineHeight: 1.95, margin: "0 0 12px" }}>
                <span style={{ color: profileAccent, marginRight: 8 }}>・</span>{a}
              </p>
            ))}
            {anecdotes.length > 4 && (
              <button onClick={() => setShowAll(!showAll)} style={{ fontFamily: serif, fontSize: 12.5, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "4px 14px", cursor: "pointer" }}>
                {showAll ? "收起" : `展開其餘 ${anecdotes.length - 4} 條`}
              </button>
            )}
          </div>
        )}

        {c.highlight && c.highlight.length > 0 && (
          <div style={{ marginTop: 24, border: `1px solid ${profileAccent}55`, borderLeft: `3px solid ${profileAccent}`, padding: "12px 16px" }}>
            <SectionLabel>高光</SectionLabel>
            {c.highlight.map((h, i) => (
              <div key={i} style={{ fontFamily: serif, fontSize: 14, color: T.ink, lineHeight: 1.95 }}>{h}</div>
            ))}
          </div>
        )}

        {(() => {
          const rels = RELATIONS.filter((r) => r.a === c.id || r.b === c.id);
          if (!rels.length) return null;
          return (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>關係（自關係庫）</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {rels.map((r, i) => {
                  const o = byId[r.a === c.id ? r.b : r.a];
                  return (
                    <button key={i} onClick={() => { setShowAll(false); onOpenChar(o); }}
                      style={{ fontSize: 12.5, fontFamily: serif, color: T.ink, background: T.panelHi, border: `1px ${r.da ? "dashed" : "solid"} ${relColor(r.t)}88`, padding: "4px 10px", borderRadius: "3px", cursor: "pointer", textAlign: "left" }}>
                      {o.name}
                      <span style={{ color: relColor(r.t), marginLeft: 8, fontSize: 11 }}>{r.t}</span>
                      <span style={{ color: T.faint, marginLeft: 6, fontSize: 10.5 }}>
                        {r.y0 ?? "？"}{r.y1 != null && r.y1 !== r.y0 ? `—${r.y1}` : ""}{r.ph ? " · 殁后" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {coList.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>同事人物（共見事件計數）</SectionLabel>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {coList.map(([id, n]) => (
                <button key={id} onClick={() => { setShowAll(false); onOpenChar(byId[id]); }} style={{ fontSize: 13, fontFamily: serif, color: T.ink, background: T.panelHi, border: `1px solid ${T.line}`, padding: "4px 10px", borderRadius: "3px", cursor: "pointer" }}>
                  {byId[id].name}<span style={{ color: T.muted, marginLeft: 8, fontSize: 11 }}>{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {related.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>繫年事件（依 年·月·序號）</SectionLabel>
            {(() => {
              let ly = null;
              return related.map((e, i) => {
                const firstOfYear = e.year !== ly;
                ly = e.year;
                return (
                  <div key={i} style={{ display: "flex", gap: 14, marginTop: 10 }}>
                    <div style={{ minWidth: 78 }}>
                      <div style={{ fontFamily: serif, color: T.accent, fontSize: 13 }}>
                        {e.year}{e.month != null && `·${e.month}月`}{e.seq && ` ${e.seq}`}
                      </div>
                      {firstOfYear && (
                        <div style={{ fontFamily: serif, fontSize: 10.5, color: T.faint, marginTop: 1 }}>{eraOf(e.year)}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.75, fontFamily: serif }}>{e.title}</div>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div style={{ marginTop: 24, fontSize: 13, color: T.faint, fontFamily: serif }}>事件庫中暫無此人繫年條目。</div>
        )}

        {mentionGroups.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>見於文庫（本名計數）</SectionLabel>
            {mentionGroups.map((g) => {
              const open = openGroups.has(g.key);
              return (
                <div key={g.key} style={{ marginBottom: 6 }}>
                  <button onClick={() => toggleGroup(g.key)}
                    style={{ display: "block", textAlign: "left", fontSize: 12.5, fontFamily: serif, color: T.ink, background: T.panelHi, border: `1px solid ${T.line}`, padding: "4px 10px", borderRadius: "3px", cursor: "pointer" }}>
                    <span style={{ color: T.accent, fontSize: 10, marginRight: 6 }}>{open ? "▾" : "▸"}</span>
                    【{g.label}】
                    <span style={{ color: T.muted, marginLeft: 8, fontSize: 11 }}>{g.chapters.length} 章</span>
                  </button>
                  {open && (
                    <div className="flex flex-wrap" style={{ gap: 8, margin: "8px 0 10px 22px" }}>
                      {g.chapters.map(({ f, n }) => (
                        <button key={f.path} onClick={() => { setShowAll(false); onOpenNovel(f.path); }}
                          style={{ fontSize: 12.5, fontFamily: serif, color: T.ink, background: T.panelHi, border: `1px solid ${T.line}`, padding: "4px 10px", borderRadius: "3px", cursor: "pointer" }}>
                          {f.ch.title}<span style={{ color: T.muted, marginLeft: 8, fontSize: 11 }}>{n} 处</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 年表 ---------------- */
/* ---------------- 事件年表：自適應分段折疊 + 側欄目錄 ---------------- */
/* 段界為顯式常量：疏處以紀元歸併，亂世十年（755—765）細分，尾部合段。
   日後調整段界，改 from / to / label 即可，歸桶、計數、色帶自動跟隨。
   歸桶規則：取第一個 year <= to 的段；早於首段者入首段，晚於末段者入末段。 */
const TIMELINE_SECTIONS = [
  { key: "s00", from: 651, to: 706, label: "永徽—神龙" },
  { key: "s01", from: 707, to: 736, label: "景龙—开元二十四年" },
  { key: "s02", from: 737, to: 744, label: "开元二十五年—天宝三年" },
  { key: "s03", from: 745, to: 751, label: "天宝四年—十年" },
  { key: "s04", from: 752, to: 754, label: "天宝十一年—十三年" },
  { key: "s05", from: 755, to: 755, label: "天宝十四年" },
  { key: "s06", from: 756, to: 756, label: "天宝十五年—至德元年", byMonth: true },
  { key: "s07", from: 757, to: 757, label: "至德二年", byMonth: true },
  { key: "s08", from: 758, to: 759, label: "乾元元年—二年" },
  { key: "s09", from: 760, to: 761, label: "上元元年—二年" },
  { key: "s10", from: 762, to: 763, label: "宝应元年—二年" },
  { key: "s11", from: 764, to: 765, label: "广德二年—永泰元年" },
  { key: "s12", from: 766, to: 800, label: "大历—贞元" },
];
const CN_DIG = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const cnCount = (n) => {
  if (n < 10) return CN_DIG[n];
  if (n < 20) return "十" + (n % 10 ? CN_DIG[n % 10] : "");
  if (n < 100) return CN_DIG[Math.floor(n / 10)] + "十" + (n % 10 ? CN_DIG[n % 10] : "");
  return String(n);
};
const secYears = (s) => (s.from === s.to ? String(s.from) : `${s.from}–${s.to}`);
/* 年中改元者，月份標籤分軌（byMonth 僅施於單年段；756 七月改元至德） */
const ERA_SWITCH = { 756: { at: 7, before: "天宝十五年", after: "至德元年" } };
const eraOfYM = (y, m) => {
  const s = ERA_SWITCH[y];
  if (s && m != null) return m < s.at ? s.before : s.after;
  return eraOf(y);
};

/* 門派色帶：段內各門派事件占比壓成一根橫向色帶；未標門派以中性深灰收尾 */
function FacBand({ segs, none, height = 4, maxWidth }) {
  if (segs.length === 0 && none === 0) return null;
  return (
    <div style={{ display: "flex", height, maxWidth: maxWidth || "100%", overflow: "hidden", opacity: 0.9 }}>
      {segs.map(([f, n]) => (
        <div key={f} style={{ flexGrow: n, flexBasis: 0, background: fc(f) }} title={`${f}：${n}`} />
      ))}
      {none > 0 && <div style={{ flexGrow: none, flexBasis: 0, background: "#3A424D" }} title={`门派未标：${none}`} />}
    </div>
  );
}

/* 事件行：年表主列表単條，供平鋪與月組兩種佈局共用 */
function EvRow({ e, showYear, onOpenChar }) {
  return (
    <div style={{ position: "relative", padding: "0 0 24px 26px" }}>
      <div style={{ position: "absolute", left: -5, top: 7, width: 9, height: 9, background: showYear ? T.accent : T.faint, transform: "rotate(45deg)" }} />
      {showYear && (
        <div style={{ position: "absolute", left: -66, top: 1, fontFamily: serif, fontSize: 16, color: T.accent, width: 48, textAlign: "right" }}>{e.year}</div>
      )}
      <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
        <span style={{ fontFamily: serif, fontSize: 12.5, color: T.muted, minWidth: 52 }}>
          {e.month != null ? `${e.month} 月` : "月份未标"}
        </span>
        {showYear && (
          <span style={{ fontFamily: serif, fontSize: 12, color: T.muted }}>
            （{eraOf(e.year)}{e.month != null ? ` ${CN_MONTH[e.month]}` : ""}{ERA_NOTES[e.year] ? `；${ERA_NOTES[e.year]}` : ""}）
          </span>
        )}
        {e.seq && (
          <span style={{ fontSize: 11, fontFamily: serif, color: "#E7E2D6", background: T.accent, padding: "0 6px", borderRadius: "3px", lineHeight: "16px" }}>{e.seq}</span>
        )}
        {e.add && (
          <span style={{ fontSize: 11, fontFamily: serif, color: "#C9A15C", border: "1px solid #C9A15C55", padding: "0 6px", borderRadius: "3px" }} title="採自人設文檔，尚未錄入 Notion 事件庫">增補</span>
        )}
        {e.fac.length === 0 && <span style={{ fontSize: 11, color: T.faint, border: `1px dashed ${T.faint}`, padding: "0 6px", borderRadius: "3px" }}>门派未标</span>}
        {e.fac.map((f) => (
          <span key={f} style={{ fontSize: 11, color: fc(f), border: `1px solid ${fc(f)}44`, padding: "0 6px", borderRadius: "3px" }}>{f}</span>
        ))}
        {e.loc.map((l) => (
          <span key={l} style={{ fontSize: 11, color: T.faint }}>{l}</span>
        ))}
      </div>
      <div style={{ fontFamily: serif, fontSize: 15, color: T.ink, lineHeight: 1.8, marginTop: 5, maxWidth: 660 }}>{e.title}</div>
      {e.chars.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 7 }}>
          {e.chars.map((id) => (
            <button key={id} onClick={() => onOpenChar(byId[id])} style={{ fontSize: 11.5, fontFamily: serif, color: fc(byId[id].belong[0]), border: `1px solid ${fc(byId[id].belong[0])}44`, background: "none", padding: "1px 8px", borderRadius: "3px", cursor: "pointer" }}>
              {byId[id].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Timeline({ onOpenChar }) {
  const NONE_FAC = "__none__"; /* 「门派未标」一級標籤之內部鍵 */
  const ETH_GROUP = "__ethnic__"; /* 【族属/地属】傘形標籤之內部鍵 */
  const [fsel, setFsel] = useState("all"); /* 一級：門派及同級標籤 */
  const [who, setWho] = useState("all"); /* 二級：人物 */
  const [q, setQ] = useState(""); /* 事件檢索：事名、人物（名／表字）、地點、門派、編號 */
  const [expanded, setExpanded] = useState(() => new Set()); /* 默認全折疊 */
  const [expandedMonths, setExpandedMonths] = useState(() => new Set()); /* 月組次級折疊，鍵形如 "s07:10"，未標月為 -1 */
  const [active, setActive] = useState(null); /* scroll-spy 當前段 */
  const [tocHover, setTocHover] = useState(null); /* 側欄目錄懸停項 → hover 浮起 */
  const secRefs = useRef({});
  const narrow = useNarrow();
  const searching = q.trim() !== ""; /* 檢索中強制展開命中段與月組，清空即恢復原折疊狀態 */

  const inEvents = useMemo(
    () =>
      [...new Set(EVENTS.flatMap((e) => e.chars))].sort(
        (a, b) => EVENTS.filter((e) => e.chars.includes(b)).length - EVENTS.filter((e) => e.chars.includes(a)).length
      ),
    []
  );

  /* 族屬／地屬類標籤：顯式常量，運行時與實有標籤求交集（無事者不顯示）；增刪改此行即可 */
  const ETHNIC_TAGS = ["鲜卑", "羌", "奚人/狼牙", "靺鞨", "西域", "柔然", "南诏", "波斯", "苗疆"];
  /* 一級標籤：事件 fac 標籤 ∪ 涉事人物所屬門派（鮮卑、靺鞨等無事件標籤者由後者補入）。
     計數為成員包含式：事件標籤含 f，或涉事人物隸屬 f。 */
  const facList = useMemo(() => {
    const set = new Set();
    for (const e of EVENTS) {
      e.fac.forEach((f) => set.add(f));
      e.chars.forEach((id) => byId[id].belong.forEach((b) => set.add(b)));
    }
    const inFac = (e, f) => e.fac.includes(f) || e.chars.some((id) => byId[id].belong.includes(f));
    const arr = [...set]
      .map((f) => ({ f, n: EVENTS.filter((e) => inFac(e, f)).length }))
      .sort((a, b) => b.n - a.n);
    const main = arr.filter((x) => !ETHNIC_TAGS.includes(x.f));
    const ethnic = arr.filter((x) => ETHNIC_TAGS.includes(x.f));
    const ethnicUnion = EVENTS.filter((e) => ethnic.some(({ f }) => inFac(e, f))).length;
    return { main, ethnic, ethnicUnion, none: EVENTS.filter((e) => e.fac.length === 0).length };
  }, []);
  const isEthnic = (f) => facList.ethnic.some((x) => x.f === f);

  /* 二級人物：隸屬所選門派且見於事件者；「门派未标」下列未標事件之涉事人物 */
  const subPersons = useMemo(() => {
    if (fsel === "all") return [];
    if (fsel === NONE_FAC) return inEvents.filter((id) => EVENTS.some((e) => e.fac.length === 0 && e.chars.includes(id)));
    return inEvents.filter((id) => byId[id].belong.includes(fsel));
  }, [fsel, inEvents]);

  /* 篩選 → 排序 → 歸桶；目錄計數與色帶隨篩選實時重算 */
  const sections = useMemo(() => {
    const kw = q.trim();
    const hit = (e) =>
      kw === "" ||
      e.title.includes(kw) ||
      (e.seq || "").includes(kw) ||
      e.loc.some((l) => l.includes(kw)) ||
      e.fac.some((f) => f.includes(kw)) ||
      eraOfYM(e.year, e.month).includes(kw) ||
      e.chars.some((id) => byId[id].name.includes(kw) || (byId[id].zi || "").includes(kw));
    const byFaction = (e) =>
      who !== "all" || /* 已選人物則取其完整編年 */
      fsel === "all" ||
      (fsel === NONE_FAC
        ? e.fac.length === 0
        : fsel === ETH_GROUP
        ? facList.ethnic.some(({ f }) => e.fac.includes(f) || e.chars.some((id) => byId[id].belong.includes(f)))
        : e.fac.includes(fsel) || e.chars.some((id) => byId[id].belong.includes(fsel)));
    const shown = EVENTS.filter((e) => (who === "all" || e.chars.includes(who)) && byFaction(e) && hit(e)).sort(sortEvents);
    const buckets = TIMELINE_SECTIONS.map((s) => ({ ...s, evs: [] }));
    for (const e of shown) {
      const b = buckets.find((s) => e.year <= s.to) || buckets[buckets.length - 1];
      b.evs.push(e);
    }
    return buckets.map((b) => {
      const tally = {};
      let none = 0;
      for (const e of b.evs) {
        if (e.fac.length === 0) none += 1;
        else for (const f of e.fac) tally[f] = (tally[f] || 0) + 1;
      }
      return { ...b, none, segs: Object.entries(tally).sort((x, y) => y[1] - x[1]) };
    });
  }, [who, fsel, q, facList]);

  /* scroll-spy：主列表滾至何段，目錄對應條目高亮 */
  useEffect(() => {
    const onScroll = () => {
      let cur = null;
      for (const s of TIMELINE_SECTIONS) {
        const el = secRefs.current[s.key];
        if (el && el.getBoundingClientRect().top <= 120) cur = s.key;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const monthKeysOf = (s) => {
    const seen = new Set();
    for (const e of s.evs) {
      const m = e.month == null ? -1 : e.month;
      seen.add(`${s.key}:${m}`);
    }
    return [...seen];
  };
  const toggleAllMonths = (s) => {
    const keys = monthKeysOf(s);
    setExpandedMonths((prev) => {
      const allOpen = keys.every((k) => prev.has(k));
      const next = new Set(prev);
      keys.forEach((k) => (allOpen ? next.delete(k) : next.add(k)));
      return next;
    });
  };
  const toggleMonth = (gk) =>
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(gk) ? next.delete(gk) : next.add(gk);
      return next;
    });
  const expandAll = () => {
    setExpanded(new Set(sections.filter((s) => s.evs.length > 0).map((s) => s.key)));
    const mk = [];
    for (const s of sections) {
      if (!s.byMonth) continue;
      const seen = new Set();
      for (const e of s.evs) {
        const m = e.month == null ? -1 : e.month;
        if (!seen.has(m)) { seen.add(m); mk.push(`${s.key}:${m}`); }
      }
    }
    setExpandedMonths(new Set(mk));
  };
  const collapseAll = () => { setExpanded(new Set()); setExpandedMonths(new Set()); };
  /* 目錄點擊 = 展開 + 平滑滾動 二合一 */
  const jumpTo = (key) => {
    setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    requestAnimationFrame(() => {
      const el = secRefs.current[key];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* 目錄條目（寬屏側欄與窄屏芯片共用數據） */
  const Toc = () => (
    <div className="toc-scroll" style={{ width: 180, flexShrink: 0, position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", overflowX: "hidden", paddingRight: 12 }}>
      {/* 目錄縱向滾動條深色化：僅作用於 .toc-scroll，不及全站 */}
      <style>{`
.toc-scroll{scrollbar-width:thin;scrollbar-color:#5B6470 #171B21}
.toc-scroll::-webkit-scrollbar{width:8px}
.toc-scroll::-webkit-scrollbar-track{background:#171B21}
.toc-scroll::-webkit-scrollbar-thumb{background:#5B6470;border-radius:4px}
.toc-scroll::-webkit-scrollbar-thumb:hover{background:#788493}
`}</style>
      <div style={{ fontSize: 10.5, letterSpacing: "0.4em", color: T.faint, marginBottom: 10 }}>分段目錄</div>
      {sections.map((s) => {
        const empty = s.evs.length === 0;
        const isActive = active === s.key;
        const hov = tocHover === s.key && !empty;
        return (
          <button
            key={s.key}
            disabled={empty}
            onClick={() => jumpTo(s.key)}
            onMouseEnter={() => { if (!empty) setTocHover(s.key); }}
            onMouseLeave={() => setTocHover((h) => (h === s.key ? null : h))}
            style={{
              display: "block", width: "100%", textAlign: "left", background: hov ? "rgba(255,255,255,0.045)" : "none",
              border: "none", borderLeft: isActive ? `2px solid ${T.accent}` : `2px solid transparent`,
              padding: hov ? "11px 12px 12px 14px" : "7px 8px 8px 10px", /* hover 四向各擴 4px，負 margin 補償，不擠鄰項 */
              margin: hov ? "-4px" : 0,
              cursor: empty ? "default" : "pointer", opacity: empty ? 0.35 : 1,
              transform: hov ? "translateX(6px) translateY(-2px) scale(1.025)" : "none",
              boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.045)" : "none",
              borderRadius: hov ? "4px" : 0,
              transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
            }}>
            <div style={{ fontFamily: serif, fontSize: 12.5, color: isActive ? T.ink : T.muted, lineHeight: 1.5 }}>{s.label}</div>
            <div style={{ fontFamily: serif, fontSize: 10.5, color: T.faint, margin: "2px 0 5px" }}>
              {secYears(s)} · {cnCount(s.evs.length)}事
            </div>
            <FacBand segs={s.segs} none={s.none} />
          </button>
        );
      })}
      <div className="flex" style={{ gap: 6, marginTop: 12, paddingLeft: 10 }}>
        <button onClick={expandAll} style={{ fontSize: 11, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "2px 8px", cursor: "pointer" }}>全部展開</button>
        <button onClick={collapseAll} style={{ fontSize: 11, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "2px 8px", cursor: "pointer" }}>全部收起</button>
      </div>
    </div>
  );

  /* 窄屏：目錄退化為列表頂部橫向可滑動分段芯片 */
  const TocStrip = () => (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: T.bg, display: "flex", gap: 6, overflowX: "auto", padding: "8px 0 10px", marginBottom: 4, borderBottom: `1px solid ${T.line}` }}>
      {sections.map((s) => {
        const empty = s.evs.length === 0;
        const isActive = active === s.key;
        return (
          <button
            key={s.key}
            disabled={empty}
            onClick={() => jumpTo(s.key)}
            style={{
              flexShrink: 0, fontFamily: serif, fontSize: 11.5,
              color: isActive ? "#E7E2D6" : T.muted,
              background: isActive ? T.accent : "transparent",
              border: `1px solid ${isActive ? T.accent : T.line}`,
              padding: "2px 10px", cursor: empty ? "default" : "pointer", opacity: empty ? 0.35 : 1,
            }}>
            {secYears(s)} · {cnCount(s.evs.length)}事
          </button>
        );
      })}
      <button onClick={expandAll} style={{ flexShrink: 0, fontSize: 11, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "2px 8px", cursor: "pointer" }}>全展</button>
      <button onClick={collapseAll} style={{ flexShrink: 0, fontSize: 11, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "2px 8px", cursor: "pointer" }}>全收</button>
    </div>
  );

  return (
    <div>
      {narrow && <TocStrip />}
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        {!narrow && <Toc />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: fsel === "all" ? 18 : 10 }}>
            <Chip active={fsel === "all"} onClick={() => { setFsel("all"); setWho("all"); }} label="全部" />
            {facList.main.map(({ f, n }) => (
              <Chip key={f} active={fsel === f} onClick={() => { setFsel(f); setWho("all"); }} label={`${f} ${n}`} />
            ))}
            {facList.ethnic.length > 0 && (
              <Chip
                active={fsel === ETH_GROUP || isEthnic(fsel)}
                onClick={() => { setFsel(ETH_GROUP); setWho("all"); }}
                label={`族属/地属 ${facList.ethnicUnion}`} />
            )}
            {facList.none > 0 && (
              <Chip active={fsel === NONE_FAC} onClick={() => { setFsel(NONE_FAC); setWho("all"); }} label={`门派未标 ${facList.none}`} />
            )}
          </div>
          {(fsel === ETH_GROUP || isEthnic(fsel)) && (
            <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: isEthnic(fsel) ? 10 : 18, paddingLeft: 4, borderLeft: `2px solid ${T.line}` }}>
              <span style={{ fontSize: 11, fontFamily: serif, color: T.faint, margin: "0 4px" }}>族属/地属 · 标签</span>
              {facList.ethnic.map(({ f, n }) => (
                <Chip key={f} active={fsel === f}
                  onClick={() => { setFsel((prev) => (prev === f ? ETH_GROUP : f)); setWho("all"); }}
                  label={`${f} ${n}`} />
              ))}
            </div>
          )}
          {fsel !== "all" && fsel !== ETH_GROUP && (
            <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 18, paddingLeft: 4, borderLeft: `2px solid ${T.line}` }}>
              <span style={{ fontSize: 11, fontFamily: serif, color: T.faint, margin: "0 4px" }}>
                {fsel === NONE_FAC ? "未标事件 · 人物" : `${fsel} · 人物`}
              </span>
              {subPersons.map((id) => (
                <Chip key={id} active={who === id} onClick={() => setWho((prev) => (prev === id ? "all" : id))} label={byId[id].name} />
              ))}
              {subPersons.length === 0 && (
                <span style={{ fontSize: 11.5, fontFamily: serif, color: T.faint }}>此標籤下無入事人物檔案</span>
              )}
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <span style={{ position: "relative", display: "inline-block" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="檢索事名、人物、地點、門派、紀年"
                style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: "3px", color: T.ink, fontSize: 13, fontFamily: serif, padding: "6px 12px 6px 34px", outline: "none", minWidth: 300 }} />
              <SearchTag />
            </span>
          </div>
          {sections.every((s) => s.evs.length === 0) && (
            <div style={{ color: T.faint, fontFamily: serif, padding: 40, textAlign: "center" }}>無合於此檢索之事。</div>
          )}
          {sections.map((s) => {
            const empty = s.evs.length === 0;
            const open = (searching || expanded.has(s.key)) && !empty;
            return (
              <div key={s.key} style={{ marginBottom: open ? 10 : 0 }}>
                <div
                  ref={(el) => { secRefs.current[s.key] = el; }}
                  onClick={() => !empty && toggle(s.key)}
                  style={{
                    position: "sticky", top: narrow ? 42 : 0, zIndex: 3, background: T.bg,
                    borderBottom: `1px solid ${T.line}`, padding: "10px 0 9px",
                    cursor: empty ? "default" : "pointer", opacity: empty ? 0.35 : 1,
                    scrollMarginTop: narrow ? 46 : 4,
                  }}>
                  <div className="flex items-baseline flex-wrap" style={{ gap: 10 }}>
                    <span style={{ color: T.accent, fontSize: 12, width: 13, display: "inline-block" }}>{open ? "▾" : "▸"}</span>
                    <span style={{ fontFamily: serif, fontSize: 15.5, color: T.ink }}>{s.label}</span>
                    <span style={{ fontFamily: serif, fontSize: 12, color: T.muted }}>
                      {secYears(s)} · {empty ? "無事" : `${cnCount(s.evs.length)}事`}
                    </span>
                    {s.byMonth && open && !searching && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggleAllMonths(s); }}
                        style={{ marginLeft: "auto", fontSize: 11, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "1px 8px", cursor: "pointer" }}>
                        {monthKeysOf(s).every((k) => expandedMonths.has(k)) ? "收起諸月" : "展開諸月"}
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 7, marginLeft: 23 }}>
                    <FacBand segs={s.segs} none={s.none} maxWidth={340} />
                  </div>
                </div>
                {open && (
                  <div style={{ borderLeft: `1px solid ${T.line}`, marginLeft: 40, paddingTop: 18 }}>
                    {(() => {
                      let lastYear = null;
                      const row = (e, key) => {
                        const showYear = e.year !== lastYear;
                        lastYear = e.year;
                        return <EvRow key={key} e={e} showYear={showYear} onOpenChar={onOpenChar} />;
                      };
                      if (!s.byMonth) return s.evs.map((e, i) => row(e, i));
                      /* 月份次級折疊：evs 已按 sortEvents 排定（未標月居首），依次歸組 */
                      const groups = [];
                      for (const e of s.evs) {
                        const m = e.month == null ? -1 : e.month;
                        const last = groups[groups.length - 1];
                        if (last && last.m === m) last.evs.push(e);
                        else groups.push({ m, evs: [e] });
                      }
                      return groups.map((g) => {
                        const gk = `${s.key}:${g.m}`;
                        const gOpen = searching || expandedMonths.has(gk);
                        const mLabel = g.m === -1 ? "月份未標" : CN_MONTH[g.m];
                        return (
                          <div key={gk}>
                            <div
                              onClick={() => toggleMonth(gk)}
                              style={{ position: "relative", padding: "0 0 18px 26px", cursor: "pointer", userSelect: "none" }}>
                              <div style={{ position: "absolute", left: -8, top: 4, width: 13, height: 13, border: `1px solid ${T.accent}`, background: gOpen ? T.accent : T.bg, transform: "rotate(45deg)" }} />
                              <span style={{ color: T.accent, fontSize: 11, marginRight: 8 }}>{gOpen ? "▾" : "▸"}</span>
                              <span style={{ fontFamily: serif, fontSize: 13.5, color: gOpen ? T.ink : T.muted }}>{mLabel}</span>
                              {g.m !== -1 && (
                                <span style={{ fontFamily: serif, fontSize: 11.5, color: T.faint, marginLeft: 8 }}>{eraOfYM(s.from, g.m)}{mLabel}</span>
                              )}
                              <span style={{ fontFamily: serif, fontSize: 11.5, color: T.faint, marginLeft: 10 }}>{cnCount(g.evs.length)}事</span>
                            </div>
                            {gOpen && g.evs.map((e, i) => row(e, `${gk}-${i}`))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 圖幅縮放平移：滑鼠與觸屏共用 ---------------- */
/* 三幅圖（行星、群像、輿地）共用。k 為倍率，t 為平移（viewBox 座標）。
   k===1 時一概不接管手勢：touchAction 交還瀏覽器，單指仍可劃過圖幅翻頁，
   放大須先按 ＋；k>1 後才吃掉手勢，做單指平移與雙指捏合（以兩指中點為錨）。 */
function usePanZoom(w, h) {
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  /* 回調恒讀最新 view：pointerup 與排隊中的 pointermove 更新可交錯，
     閉包裡的 view 會滯後，據之計算則圖幅跳變 */
  const viewRef = useRef(view);
  viewRef.current = view;
  const ptsRef = useRef(new Map()); /* pointerId → 當前屏幕座標，多指並存 */
  const dragRef = useRef(null);     /* 單指／滑鼠拖曳起點暫存 */
  const pinchRef = useRef(null);    /* 捏合起手：兩指距離、中點、當時 view */
  const movedRef = useRef(0);       /* 拖曳位移量：>5 則抑制本次點選，防拖後誤觸 */

  const clampK = (k) => Math.min(8, Math.max(1, k));
  /* 以幅面中心為錨：＋／－ 按鈕走此路 */
  const zoomBy = (f) =>
    setView((v) => {
      const k2 = clampK(v.k * f);
      if (k2 === 1) return { k: 1, tx: 0, ty: 0 };
      const cx = w / 2, cy = h / 2;
      return { k: k2, tx: cx - (k2 / v.k) * (cx - v.tx), ty: cy - (k2 / v.k) * (cy - v.ty) };
    });
  const reset = () => setView({ k: 1, tx: 0, ty: 0 });

  const endPointer = (e) => {
    const pts = ptsRef.current;
    pts.delete(e.pointerId);
    /* 安卓上指針或已自行釋放，release 之則擲 NotFoundError，故先問後放並兜住 */
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* 已釋放，無妨 */ }
    if (pts.size < 2) pinchRef.current = null;
    /* 捏合鬆開一指：以殘留之指重新起手，免圖幅跳變 */
    if (pts.size === 1) {
      const [r] = [...pts.values()];
      const v = viewRef.current;
      dragRef.current = { x: r.x, y: r.y, tx: v.tx, ty: v.ty };
    } else if (pts.size === 0) {
      dragRef.current = null;
    }
  };

  const handlers = {
    onPointerDown: (e) => {
      /* 位移量無條件歸零：k===1 時亦然。否則「放大→拖動→復位」後
         movedRef 永停於 >5，此後一切點選盡被當作拖後誤觸吞掉 */
      movedRef.current = 0;
      const v = viewRef.current;
      if (v.k === 1) return;
      const pts = ptsRef.current;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* 捕獲不成則退為普通事件流 */ }
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        pinchRef.current = {
          d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
          k: v.k, tx: v.tx, ty: v.ty,
        };
        dragRef.current = null;
      } else {
        dragRef.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
      }
    },
    onPointerMove: (e) => {
      const pts = ptsRef.current;
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cw = e.currentTarget.clientWidth || e.currentTarget.getBoundingClientRect().width;
      if (!cw) return; /* 幅面尚未布局，此刻換算必得 Infinity */
      const s = w / cw; /* 屏幕像素 → viewBox 座標 */
      const p = pinchRef.current;
      if (p && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!d || !p.d) return;
        const rect = e.currentTarget.getBoundingClientRect();
        /* 起手中點所指之內容座標，須始終落在當下中點之下 */
        const ax = (p.mx - rect.left) * s, ay = (p.my - rect.top) * s;
        const gx = (ax - p.tx) / p.k, gy = (ay - p.ty) / p.k;
        const cx = ((a.x + b.x) / 2 - rect.left) * s, cy = ((a.y + b.y) / 2 - rect.top) * s;
        const k2 = clampK(p.k * (d / p.d));
        movedRef.current = 99; /* 捏合畢不誤觸點選 */
        setView({ k: k2, tx: cx - k2 * gx, ty: cy - k2 * gy });
        return;
      }
      /* 必先取出快照再入 setView：updater 由 React 稍後執行，屆時
         pointerup 可能已將 dragRef 置空，於彼時解引用即擲錯而白屏 */
      const g = dragRef.current;
      if (!g) return;
      const dx = (e.clientX - g.x) * s, dy = (e.clientY - g.y) * s;
      movedRef.current = Math.max(movedRef.current, Math.abs(dx) + Math.abs(dy));
      setView((v) => ({ ...v, tx: g.tx + dx, ty: g.ty + dy }));
    },
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
  };
  /* 指針捕獲既已接管，拖出幅外不必中斷，故不掛 onPointerLeave */
  const gestureStyle = {
    cursor: view.k > 1 ? (dragRef.current ? "grabbing" : "grab") : "default",
    touchAction: view.k > 1 ? "none" : "auto",
  };
  return { view, zoomBy, reset, handlers, gestureStyle, movedRef };
}

/* 縮放三鈕：放大／縮小／復位，三幅圖共用 */
function ZoomBtns({ view, zoomBy, reset }) {
  return (
    <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 3, alignItems: "center" }}>
      {[["＋", () => zoomBy(1.5), "放大"], ["－", () => zoomBy(1 / 1.5), "縮小"], ["回", reset, "復位"]].map(([t, fn, tt]) => (
        <button key={tt} title={tt} onClick={fn}
          style={{ width: 30, height: 30, fontFamily: serif, fontSize: 14, color: T.ink, background: T.panelHi, border: `1px solid ${T.line}`, borderRadius: "3px", cursor: "pointer", padding: 0, opacity: tt !== "放大" && view.k === 1 ? 0.45 : 1 }}>
          {t}
        </button>
      ))}
      {view.k > 1 && <span style={{ fontFamily: serif, fontSize: 10.5, color: T.faint }}>{view.k.toFixed(1)}×</span>}
    </div>
  );
}

/* ---------------- 行星式關係圖：雙星系統 ---------------- */
/* 兩核：閔方城（蒼雲線）與程凱（天策線）。
   軌道悉由《事件与年份》與各核之共見計數自動生成；
   與兩核共見皆 ≥2 者為「橋星」，居於雙星連線之中央；
   與兩核皆無共見者列於環抱全系之遠軌。 */
function Planetary({ onOpenChar }) {
  const [hover, setHover] = useState(null);
  const { view, zoomBy, reset, handlers, gestureStyle, movedRef } = usePanZoom(1200, 830);
  const coarse = useCoarsePointer();
  const CX = [350, 850], CY = 410;
  const layout = useMemo(() => {
    const counts = CENTERS_META.map((m) => coCountsFor(m.id));
    const RINGS = [
      { label: "內軌 ≥6", r: 108, test: (n) => n >= 6 },
      { label: "中軌 3–5", r: 178, test: (n) => n >= 3 && n <= 5 },
      { label: "外軌 1–2", r: 248, test: (n) => n >= 1 && n <= 2 },
    ];
    const centerIds = CENTERS_META.map((m) => m.id);
    const shared = [], far = [], sys = [[], []];
    for (const c of CHARACTERS) {
      if (centerIds.includes(c.id)) continue;
      const a = counts[0][c.id] || 0, b = counts[1][c.id] || 0;
      if (Math.min(a, b) >= 2) shared.push({ c, a, b });
      else if (a === 0 && b === 0) far.push(c);
      else if (a >= b) sys[0].push({ c, n: a });
      else sys[1].push({ c, n: b });
    }
    shared.sort((x, y) => y.a + y.b - (x.a + x.b));
    /* 各系星體：面向外側展開，避讓雙星之間的橋區 */
    const rings = sys.map((members, k) => {
      const outward = k === 0 ? Math.PI : 0;
      return RINGS.map((ring, ri) => {
        const ms = members
          .filter((m) => ring.test(m.n))
          .sort((x, y) => (x.c.belong[0] || "").localeCompare(y.c.belong[0] || "") || y.n - x.n);
        const span = Math.PI * 2 * 0.73;
        const start = outward - span / 2 + ri * 0.22;
        return {
          ...ring,
          nodes: ms.map((m, i) => {
            const ang = start + ((i + 0.5) / ms.length) * span;
            return { ...m, x: CX[k] + ring.r * Math.cos(ang), y: CY + ring.r * Math.sin(ang), k };
          }),
        };
      });
    });
    /* 橋星：居雙星連線中央，縱向錯落 */
    const bridge = shared.map((m, i) => ({
      ...m, x: 600, y: CY + (i - (shared.length - 1) / 2) * 72,
    }));
    /* 遠軌：環抱全系之橢圓 */
    const FAR = { rx: 552, ry: 356 };
    const farNodes = far
      .sort((x, y) => (x.belong[0] || "").localeCompare(y.belong[0] || ""))
      .map((c, i) => {
        const ang = -Math.PI / 2 + (i / far.length) * Math.PI * 2;
        return { c, x: 600 + FAR.rx * Math.cos(ang), y: CY + FAR.ry * Math.sin(ang) };
      });
    return { rings, bridge, farNodes, FAR, RINGS };
  }, []);

  const pos = {};
  CENTERS_META.forEach((m, k) => { pos[m.id] = { x: CX[k], y: CY }; });
  layout.rings.forEach((sysRings) => sysRings.forEach((ring) => ring.nodes.forEach((n) => { pos[n.c.id] = { x: n.x, y: n.y }; })));
  layout.bridge.forEach((n) => { pos[n.c.id] = { x: n.x, y: n.y }; });
  layout.farNodes.forEach((n) => { pos[n.c.id] = { x: n.x, y: n.y }; });

  const centerIds = CENTERS_META.map((m) => m.id);
  const chords = hover
    ? RELATIONS.filter((r) => (r.a === hover || r.b === hover) && pos[r.a] && pos[r.b] && !centerIds.includes(r.a) && !centerIds.includes(r.b))
    : [];

  const Star = ({ k }) => {
    const c = byId[CENTERS_META[k].id];
    return (
      <g style={{ cursor: "pointer" }} onClick={() => { if (movedRef.current > 5) return; onOpenChar(c); }}>
        <text x={CX[k]} y={CY - 66} textAnchor="middle"
          style={{ fontFamily: serif, fontSize: 11.5, fill: fc(c.belong[0]), letterSpacing: "0.45em" }}>
          {CENTERS_META[k].tag}
        </text>
        <circle cx={CX[k]} cy={CY} r={40} fill={T.panel} stroke={T.accent} strokeWidth={2.4} />
        <circle cx={CX[k]} cy={CY} r={47} fill="none" stroke={T.accent} strokeWidth={0.7} opacity={0.5} />
        <text x={CX[k]} y={CY - 7} textAnchor="middle" style={{ fontFamily: serif, fontSize: 16, fill: T.ink, fontWeight: 700 }}>{c.name}</text>
        <text x={CX[k]} y={CY + 10} textAnchor="middle" style={{ fontFamily: serif, fontSize: 10.5, fill: T.muted }}>{c.birth} — {c.death}</text>
        <text x={CX[k]} y={CY + 24} textAnchor="middle" style={{ fontFamily: serif, fontSize: 8.5, fill: T.faint }}>{eraOf(c.birth)} — {eraOf(c.death)}</text>
      </g>
    );
  };

  const Node = ({ n, countLabel }) => {
    const hi = hover === n.c.id;
    return (
      <g style={{ cursor: "pointer" }}
        onMouseEnter={() => { if (!coarse) setHover(n.c.id); }}
        onMouseLeave={() => { if (!coarse) setHover(null); }}
        /* 觸屏無懸停：首觸牽出其關係弧，再觸方開檔案 */
        onClick={() => { if (movedRef.current > 5) return; if (coarse && hover !== n.c.id) { setHover(n.c.id); return; } onOpenChar(n.c); }}>
        {coarse && <circle cx={n.x} cy={n.y} r={30} fill="transparent" />}
        <circle cx={n.x} cy={n.y} r={hi ? 24 : 20} fill={T.panel} stroke={fc(n.c.belong[0])} strokeWidth={1.6} />
        {n.c.belong.length > 1 && (
          <circle cx={n.x} cy={n.y} r={hi ? 28 : 24} fill="none" stroke={fc(n.c.belong[1])} strokeWidth={0.8} opacity={0.7} />
        )}
        <text x={n.x} y={n.y + 4} textAnchor="middle"
          style={{ fontFamily: serif, fontSize: n.c.name.length > 3 ? 9 : n.c.name.length > 2 ? 10.5 : 12.5, fill: T.ink }}>
          {n.c.name}
        </text>
        {countLabel && (
          <text x={n.x} y={n.y + (hi ? 40 : 36)} textAnchor="middle"
            style={{ fontFamily: serif, fontSize: 10, fill: hi ? T.accent : T.faint }}>
            {countLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <ZoomBtns view={view} zoomBy={zoomBy} reset={reset} />
      <svg viewBox="0 0 1200 830"
        style={{ width: "100%", maxWidth: 1160, display: "block", margin: "0 auto", ...gestureStyle }}
        {...handlers}>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
        {/* 襯底：觸屏點空處即卸下所選人物，關係弦線隨之收起 */}
        <rect x={-4000} y={-4000} width={9000} height={9000} fill="transparent"
          onClick={() => { if (movedRef.current > 5) return; setHover(null); }} />
        {/* 遠軌橢圓 */}
        <ellipse cx={600} cy={CY} rx={layout.FAR.rx} ry={layout.FAR.ry} fill="none" stroke={T.line} strokeDasharray="2 5" />
        <text x={600} y={CY - layout.FAR.ry - 9} textAnchor="middle" style={{ fontFamily: serif, fontSize: 11, fill: T.faint }}>遠軌 0（與兩核俱無共見）</text>
        {/* 各系軌道 */}
        {layout.RINGS.map((ring, ri) => (
          <g key={ri}>
            {[0, 1].map((k) => (
              <circle key={k} cx={CX[k]} cy={CY} r={ring.r} fill="none" stroke={T.line} strokeDasharray="2 5" />
            ))}
            <text x={CX[0]} y={CY - ring.r - 7} textAnchor="middle" style={{ fontFamily: serif, fontSize: 11, fill: T.faint }}>{ring.label}</text>
            <text x={CX[1]} y={CY - ring.r - 7} textAnchor="middle" style={{ fontFamily: serif, fontSize: 11, fill: T.faint }}>{ring.label}</text>
          </g>
        ))}
        {/* 系內星體連線 */}
        {layout.rings.flatMap((sysRings, k) =>
          sysRings.flatMap((ring) =>
            ring.nodes.map((n) => (
              <line key={n.c.id + "l"} x1={CX[k]} y1={CY} x2={n.x} y2={n.y}
                stroke={hover === n.c.id ? T.accent : T.line}
                strokeWidth={0.5 + n.n * 0.28}
                opacity={hover && hover !== n.c.id ? 0.25 : 0.85} />
            ))
          )
        )}
        {/* 橋星連線：分別繫於兩核 */}
        {layout.bridge.map((n) => (
          <g key={n.c.id + "bl"}>
            <line x1={CX[0]} y1={CY} x2={n.x} y2={n.y} stroke={hover === n.c.id ? T.accent : T.line}
              strokeWidth={0.5 + n.a * 0.28} opacity={hover && hover !== n.c.id ? 0.25 : 0.85} />
            <line x1={CX[1]} y1={CY} x2={n.x} y2={n.y} stroke={hover === n.c.id ? T.accent : T.line}
              strokeWidth={0.5 + n.b * 0.28} opacity={hover && hover !== n.c.id ? 0.25 : 0.85} />
          </g>
        ))}
        {/* 懸停弦線：星體間之關係 */}
        {chords.map((r, i) => {
          const p1 = pos[r.a], p2 = pos[r.b];
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          const dx = mx - 600, dy = my - CY, dl = Math.sqrt(dx * dx + dy * dy) || 1;
          const cx = mx + (dx / dl) * 70, cy = my + (dy / dl) * 70;
          return (
            <g key={"ch" + i}>
              <path d={`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`} fill="none"
                stroke={relColor(r.t)} strokeWidth={1.3} strokeDasharray={r.da ? "5 4" : "none"} opacity={0.9} />
              <text x={cx} y={cy} textAnchor="middle" style={{ fontFamily: serif, fontSize: 10, fill: relColor(r.t) }}>{r.t}</text>
            </g>
          );
        })}
        <Star k={0} />
        <Star k={1} />
        {layout.rings.flatMap((sysRings) =>
          sysRings.flatMap((ring) =>
            ring.nodes.map((n) => <Node key={n.c.id} n={n} countLabel={`共 ${n.n} 事`} />)
          )
        )}
        {layout.bridge.map((n) => <Node key={n.c.id} n={n} countLabel={`閔 ${n.a} · 程 ${n.b}`} />)}
        {layout.farNodes.map((n) => <Node key={n.c.id} n={n} countLabel={null} />)}
        </g>
      </svg>
      <div style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 4, fontFamily: serif }}>
        雙星系統：閔方城（蒼雲線）與程凱（天策線）同格為核。軌道由《事件与年份》中與各核共見事件之計數自動生成，線之粗細亦然；
        與兩核共見皆不少於二事者為橋星，居雙星之間，雙繫於兩核。
        {coarse ? "輕觸一人牽出其關係弦線，再觸方開檔案；放大後可雙指捏合、單指平移。" : "點選任一人開啟檔案。"}
      </div>
    </div>
  );
}

/* ---------------- 群像網絡：門派聚類 · 時間滑桿 ---------------- */
const PHASES = [["壹 · 前史", 744], ["貳 · 亂前", 750], ["叁 · 亂中", 756], ["肆 · 主線", 762]];
function Community({ onOpenChar }) {
  const [Y, setY] = useState(765);
  const [hover, setHover] = useState(null);
  const { view, zoomBy, reset, handlers, gestureStyle, movedRef } = usePanZoom(1120, 1050);
  const coarse = useCoarsePointer();
  const { nodes, pos, centers } = useMemo(() => {
    const groups = {};
    CHARACTERS.forEach((c) => {
      const f = c.belong[0] || "其他";
      (groups[f] = groups[f] || []).push(c);
    });
    const sorted = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    /* 苍云居中；外围门派按「大小相间」排列，使相邻群圆半径之和均匀，避免重叠 */
    const periph = sorted.filter((f) => f !== "苍云");
    const names = ["苍云"];
    for (let i = 0, j = periph.length - 1; i <= j; i++, j--) {
      names.push(periph[i]);
      if (i !== j) names.push(periph[j]);
    }
    const CX0 = 560, CY0 = 535, GR = 382;
    const pos = {}, nodes = [], centers = [];
    names.forEach((f, gi) => {
      const members = groups[f];
      const central = f === "苍云";
      const ga = -Math.PI / 2 + ((gi - 1) / (names.length - 1)) * Math.PI * 2;
      const gx = central ? CX0 : CX0 + GR * Math.cos(ga);
      const gy = central ? CY0 : CY0 + GR * Math.sin(ga);
      const cr = 26 + Math.sqrt(members.length) * 26;
      centers.push({ f, gx, gy, cr, n: members.length });
      members.forEach((c, i) => {
        const ang = i * 2.399963;
        const rad = members.length === 1 ? 0 : cr * Math.sqrt((i + 0.6) / members.length);
        const x = gx + rad * Math.cos(ang), y = gy + rad * Math.sin(ang);
        pos[c.id] = { x, y };
        nodes.push({ c, x, y, f });
      });
    });
    return { nodes, pos, centers };
  }, []);
  const active = RELATIONS.filter((r) => pos[r.a] && pos[r.b] && relActive(r, Y));

  return (
    <div>
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 6 }}>
        {PHASES.map(([label, y]) => (
          <Chip key={label} active={Y === y} onClick={() => setY(y)} label={label} />
        ))}
        <input type="range" min={730} max={765} value={Y} onChange={(e) => setY(+e.target.value)}
          style={{ flex: 1, minWidth: 180, accentColor: T.accent }} />
        <span style={{ fontFamily: serif, fontSize: 16, color: T.accent, minWidth: 170, textAlign: "right" }}>
          {Y}（{eraOf(Y)}）
        </span>
      </div>
      <div className="flex flex-wrap" style={{ gap: 14, marginBottom: 4, justifyContent: "center" }}>
        {[["傳承", "#7FB0D8"], ["遺承", "#9B7EC8"], ["情愛", "#D88BA8"], ["恩義", "#C9A15C"], ["誼", "#7FA980"], ["親緣", "#B08968"], ["嫌隙", "#C8B45A"], ["殺伐", "#C05050"]].map(([l, cc]) => (
          <span key={l} style={{ fontSize: 11, fontFamily: serif, color: cc }}>— {l}</span>
        ))}
        <span style={{ fontSize: 11, fontFamily: serif, color: T.faint }}>虛線＝未遂／未說開／未見 · 硃砂點線＝歿後延續 · 虛環＝其人已歿</span>
      </div>
      <div style={{ overflowX: "auto", position: "relative" }}>
        <ZoomBtns view={view} zoomBy={zoomBy} reset={reset} />
        <svg viewBox="0 0 1120 1050"
          style={{ width: "100%", maxWidth: 1100, display: "block", margin: "0 auto", ...gestureStyle }}
          {...handlers}>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* 襯底：觸屏點空處即卸下所選人物，關係邊隨之復原 */}
          <rect x={-4000} y={-4000} width={9000} height={9000} fill="transparent"
            onClick={() => { if (movedRef.current > 5) return; setHover(null); }} />
          {centers.map((g) => (
            <text key={g.f} x={g.gx} y={g.gy - g.cr - 10} textAnchor="middle"
              style={{ fontFamily: serif, fontSize: 13, fill: fc(g.f), letterSpacing: "0.3em", opacity: 0.8 }}>
              {g.f}
            </text>
          ))}
          {active.map((r, i) => {
            const p1 = pos[r.a], p2 = pos[r.b];
            const posth = relPosthumous(r, Y);
            const hi = hover && (r.a === hover || r.b === hover);
            const dim = hover && !hi;
            return (
              <g key={i}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={posth ? T.accent : relColor(r.t)}
                  strokeWidth={hi ? 1.8 : 1}
                  strokeDasharray={posth ? "2 5" : r.da ? "6 4" : "none"}
                  opacity={dim ? 0.07 : posth ? 0.5 : hi ? 1 : 0.45} />
                {hi && (
                  <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 4} textAnchor="middle"
                    style={{ fontFamily: serif, fontSize: 10.5, fill: posth ? T.accent : relColor(r.t) }}>
                    {r.t}{posth ? "（歿後）" : ""}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            if (n.c.birth != null && n.c.birth > Y) return null;
            const dead = n.c.death != null && Y > n.c.death;
            const hi = hover === n.c.id;
            return (
              <g key={n.c.id} style={{ cursor: "pointer" }} opacity={dead ? 0.38 : 1}
                onMouseEnter={() => { if (!coarse) setHover(n.c.id); }}
                onMouseLeave={() => { if (!coarse) setHover(null); }}
                /* 觸屏無懸停：首觸顯其關係諸邊，再觸方開檔案 */
                onClick={() => { if (movedRef.current > 5) return; if (coarse && hover !== n.c.id) { setHover(n.c.id); return; } onOpenChar(n.c); }}>
                {/* 觸屏加大點選域：節點在窄屏上實徑僅數像素，另置一透明圓承接手指 */}
                {coarse && <circle cx={n.x} cy={n.y} r={26} fill="transparent" />}
                <circle cx={n.x} cy={n.y} r={hi ? 19 : 15.5} fill={T.panel}
                  stroke={fc(n.f)} strokeWidth={hi ? 2 : 1.3} strokeDasharray={dead ? "3 3" : "none"} />
                <text x={n.x} y={n.y + 3.5} textAnchor="middle"
                  style={{ fontFamily: serif, fontSize: n.c.name.length > 3 ? 8 : n.c.name.length > 2 ? 9.5 : 11, fill: T.ink }}>
                  {n.c.name}
                </text>
              </g>
            );
          })}
          </g>
        </svg>
      </div>
      <div style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 4, fontFamily: serif }}>
        諸邊依《人物关系》庫著錄，並自《东都天策府组人设》《西域组·大漠沙如雪》等諸人設文本增補——按門派聚類；拖動滑桿觀關係之生滅——邊之顯隱依起讫，硃砂點線為歿後之延續。兩核（閔方城、程凱）在此降格為普通節點：中心性不再被預設，而由網絡自證。
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{ fontSize: 12.5, fontFamily: serif, color: active ? "#E7E2D6" : T.muted, background: active ? T.accent : "transparent", border: `1px solid ${active ? T.accent : T.line}`, padding: "3px 12px", borderRadius: "3px", cursor: "pointer" }}>
      {label}
    </button>
  );
}

/* 檢索框內「查」字小方標：純視覺標識，不可點——配合外層 position:relative 容器與 input 左側讓位 padding 使用 */
const SearchTag = () => (
  <span style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 18, display: "flex", alignItems: "center", justifyContent: "center", background: T.accent, color: "#E7E2D6", fontSize: 11, fontFamily: serif, borderRadius: "3px", pointerEvents: "none" }}>查</span>
);

const NOLOC_KEY = "__noloc__"; /* 無地點事件之內部鍵 */
const TRACK_COLORS = ["#6C9FDE", "#D96A8B", "#5FBFAE"]; /* 動線識別色：霽青・桃緋・青瓷——高辨識、無門派義 */



/* 弧環分段：一地多門派時以門派色弧環表其比例；極坐標取 SVG 慣例（-90° 起順時針） */
function ringArc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(Math.min(a1, a0 + 359.9));
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/* ---------------- 山河輿圖 ---------------- */
function GeoMap({ onOpenChar }) {
  const NONE_FAC = "__none__";
  const ETH_GROUP = "__ethnic__";
  const [fsel, setFsel] = useState("all");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null); /* 選中地名（或 NOLOC_KEY）→ 側欄編年 */
  const [hover, setHover] = useState(null);
  const [allLabels, setAllLabels] = useState(false); /* 地名全顯開關 */
  const { view, zoomBy, reset, handlers, gestureStyle, movedRef } = usePanZoom(1000, 720);
  const coarse = useCoarsePointer();
  const [trackSel, setTrackSel] = useState([]); /* 動線人物（點選即顯，至多三人；滿員再選則汰最舊） */
  const toggleTrack = (id) =>
    setTrackSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? [...prev.slice(1), id] : [...prev, id]));
  /* 第三期：時間三態 —— all 全程；cum 累積至所選年（含）；year 僅當年切片 */
  const [tmode, setTmode] = useState("all");
  const [tyear, setTyear] = useState(756); /* 默認落在天寶十五年——亂之樞紐 */
  const YR = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const e of EVENTS) { if (e.year < mn) mn = e.year; if (e.year > mx) mx = e.year; }
    return { min: mn, max: mx };
  }, []);
  const inTime = (e) => tmode === "all" || (tmode === "cum" ? e.year <= tyear : e.year === tyear);
  const [hoverSeg, setHoverSeg] = useState(null); /* 悬停動線段：{ti,i,x,y,w,...}，浮出繫此段之事 */
  useEffect(() => { setHoverSeg(null); }, [trackSel, tmode, tyear]);
  const narrow = useNarrow(920);

  const inEvents = useMemo(
    () =>
      [...new Set(EVENTS.flatMap((e) => e.chars))].sort(
        (a, b) => EVENTS.filter((e) => e.chars.includes(b)).length - EVENTS.filter((e) => e.chars.includes(a)).length
      ),
    []
  );
  const ETHNIC_TAGS = ["鲜卑", "羌", "奚人/狼牙", "靺鞨", "西域", "柔然", "南诏", "波斯", "苗疆"];
  const facList = useMemo(() => {
    const set = new Set();
    for (const e of EVENTS) {
      e.fac.forEach((f) => set.add(f));
      e.chars.forEach((id) => byId[id].belong.forEach((b) => set.add(b)));
    }
    const inFac = (e, f) => e.fac.includes(f) || e.chars.some((id) => byId[id].belong.includes(f));
    const arr = [...set]
      .map((f) => ({ f, n: EVENTS.filter((e) => inFac(e, f)).length }))
      .sort((a, b) => b.n - a.n);
    const main = arr.filter((x) => !ETHNIC_TAGS.includes(x.f));
    const ethnic = arr.filter((x) => ETHNIC_TAGS.includes(x.f));
    return { main, ethnic, none: EVENTS.filter((e) => e.fac.length === 0).length };
  }, []);
  const subPersons = useMemo(() => {
    if (fsel === "all") return [];
    if (fsel === NONE_FAC) return inEvents.filter((id) => EVENTS.some((e) => e.fac.length === 0 && e.chars.includes(id)));
    if (fsel === ETH_GROUP) return inEvents.filter((id) => byId[id].belong.some((b) => ETHNIC_TAGS.includes(b)));
    return inEvents.filter((id) => byId[id].belong.includes(fsel));
  }, [fsel, inEvents]);

  /* 篩選謂詞與年表同構：門派兩級（含族屬傘）、人物、檢索 */
  const shown = useMemo(() => {
    const kw = q.trim();
    const hit = (e) =>
      kw === "" ||
      e.title.includes(kw) ||
      (e.seq || "").includes(kw) ||
      e.loc.some((l) => l.includes(kw)) ||
      e.fac.some((f) => f.includes(kw)) ||
      eraOfYM(e.year, e.month).includes(kw) ||
      e.chars.some((id) => byId[id].name.includes(kw) || (byId[id].zi || "").includes(kw));
    const byFaction = (e) =>
      who !== "all" ||
      fsel === "all" ||
      (fsel === NONE_FAC
        ? e.fac.length === 0
        : fsel === ETH_GROUP
        ? facList.ethnic.some(({ f }) => e.fac.includes(f) || e.chars.some((id) => byId[id].belong.includes(f)))
        : e.fac.includes(fsel) || e.chars.some((id) => byId[id].belong.includes(fsel)));
    return EVENTS.filter((e) => (who === "all" || e.chars.includes(who)) && byFaction(e) && hit(e) && inTime(e)).sort(sortEvents);
  }, [who, fsel, q, facList, tmode, tyear]);

  /* 聚合：每地一點，計數、門派色分佈隨篩選重算；一事多地各計一次（與檢索「地點命中」同理） */
  const spots = useMemo(() => {
    const m = {};
    let noloc = 0;
    for (const e of shown) {
      if (e.loc.length === 0) { noloc += 1; continue; }
      for (const l of e.loc) {
        if (!m[l]) m[l] = { n: 0, tally: {}, none: 0 };
        m[l].n += 1;
        if (e.fac.length === 0) m[l].none += 1;
        else for (const f of e.fac) m[l].tally[f] = (m[l].tally[f] || 0) + 1;
      }
    }
    return { m, noloc };
  }, [shown]);

  const selEvents = useMemo(() => {
    if (!sel) return [];
    if (sel === NOLOC_KEY) return shown.filter((e) => e.loc.length === 0);
    return shown.filter((e) => e.loc.includes(sel));
  }, [sel, shown]);

  /* 動線候選：名下落點（經 tloc 裁定、並補點）涉兩處以上相異地者；沿 inEvents（事件數降序）排列 */
  const trackables = useMemo(
    () =>
      inEvents.filter((id) => {
        const locs = new Set();
        for (const e of EVENTS) if (e.chars.includes(id)) {
          const l = e.tloc && Object.prototype.hasOwnProperty.call(e.tloc, id) ? e.tloc[id] : e.loc.length > 0 ? e.loc[0] : null;
          if (l != null) locs.add(l);
        }
        for (const s of TRACK_SUPPLEMENTS[id] || []) locs.add(s.loc);
        return locs.size >= 2;
      }),
    [inEvents]
  );
  /* 動線推導：取人物完整編年（不受當前篩選）併入補點，依 sortEvents 同構之比較排定；
     落點裁定三序：補點直取其 loc → 事件問 tloc 覆寫（null＝其人不在，走無地點語義）→ 取 loc[0] 為錨；
     連續同地併為一駐；無地點（或裁為不在）之事居間者記 gapBefore（該段虛線）。
     起點補點（year: null）恆居首，標「起」。駐點按地歸組出「序·年」標註，重返之地諸次並列一行。 */
  const tracks = useMemo(
    () =>
      trackSel.map((id, ti) => {
        const supps = (TRACK_SUPPLEMENTS[id] || [])
          .filter((s) => (s.year == null ? tmode !== "year" : inTime(s)))
          .map((s) => ({ ...s, supp: true })); /* 動線隨時間三態同步；無紀年起點於逐年模式不顯 */
        const evs = EVENTS.filter((e) => e.chars.includes(id) && inTime(e)).concat(supps)
          .sort((a, b) => ((a.year ?? -9999) - (b.year ?? -9999)) || ((a.month ?? 0) - (b.month ?? 0)) || (a.seq ?? "").localeCompare(b.seq ?? ""));
        const stays = [];
        let pendingGap = false;
        for (const e of evs) {
          const l = e.supp ? e.loc
            : e.tloc && Object.prototype.hasOwnProperty.call(e.tloc, id) ? e.tloc[id]
            : e.loc.length > 0 ? e.loc[0] : null;
          if (l == null) { if (stays.length > 0) pendingGap = true; continue; }
          const c = LOC_COORDS[l];
          if (!c || c.x == null) continue;
          const last = stays[stays.length - 1];
          if (last && last.loc === l) { last.toYear = e.year ?? last.toYear; pendingGap = false; continue; } /* 並駐延展迄年 */
          stays.push({ loc: l, x: c.x, y: c.y, year: e.year ?? null, toYear: e.year ?? null, gapBefore: pendingGap,
            ev: e.supp ? { year: e.year, month: e.month ?? null, title: `〔輿圖補點〕${e.note}` } : e }); /* ev＝到達首見之事（或補點注記），此段之文獻出處 */
          pendingGap = false;
        }
        const byLoc = {};
        stays.forEach((s, i) => {
          (byLoc[s.loc] = byLoc[s.loc] || { x: s.x, y: s.y, visits: [] }).visits.push(`${i + 1}·${s.year ?? "起"}`);
        });
        return { id, ti, color: TRACK_COLORS[ti % TRACK_COLORS.length], stays, locLabels: Object.entries(byLoc) };
      }),
    [trackSel, tmode, tyear]
  );
  const rOf = (n) => Math.min(3.5 + 2.0 * Math.sqrt(n), 32); /* 環徑緩放，防北疆巨核吞鄰 */
  const offBoxes = { "西": { x: 34, y: 300 }, "東": { x: 966, y: 300 } };
  const offNames = { "西": [], "東": [] };
  Object.entries(LOC_COORDS).forEach(([name, c]) => { if (c.kind === "off") offNames[c.dir].push(name); });

  /* 單地點位：暈染面／弧環／中心符號（圓＝城邑，菱＝門派） */
  const Spot = ({ name }) => {
    const c = LOC_COORDS[name];
    const d = spots.m[name];
    if (!c || c.kind === "off") return null;
    const n = d ? d.n : 0;
    const isSel = sel === name, isHov = hover === name;
    const z = view.k; /* 語義縮放：尺寸類量反除倍率，屏幕恆定；坐標隨變換拉開 */
    const r = rOf(Math.max(n, 1)) / z;
    const segs = d ? Object.entries(d.tally).sort((a, b) => b[1] - a[1]) : [];
    const segTotal = segs.reduce((s, [, v]) => s + v, 0) + (d ? d.none : 0);
    const dim = n === 0 ? 0.18 : (hover || sel) && !isSel && !isHov ? 0.45 : 1;
    let acc = 0;
    return (
      <g style={{ cursor: n > 0 ? "pointer" : "default", opacity: dim, transition: "opacity .15s" }}
        onMouseEnter={() => { if (!coarse) setHover(name); }}
        onMouseLeave={() => { if (!coarse) setHover(null); }}
        onClick={() => { if (movedRef.current > 5) return; if (n > 0) setSel(isSel ? null : name); }}>
        {/* 觸屏加大點選域：小邑環徑不足指腹之半 */}
        {coarse && n > 0 && <circle cx={c.x} cy={c.y} r={Math.max(r, 14 / z)} fill="transparent" />}
        {c.kind === "region" && (
          <ellipse cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill={segs[0] ? fc(segs[0][0]) : T.faint} opacity={0.10}
            transform={c.rot ? `rotate(${c.rot} ${c.x} ${c.y})` : undefined} stroke={T.line} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        )}
        {n > 0 && segTotal > 0 && (segs.length + (d.none ? 1 : 0)) > 1 ? (
          <>
            {segs.map(([f, v]) => {
              const a0 = (acc / segTotal) * 360; acc += v;
              const a1 = (acc / segTotal) * 360;
              return <path key={f} d={ringArc(c.x, c.y, r, a0, a1)} fill="none" stroke={fc(f)} strokeWidth={(isSel || isHov ? 4 : 3) / z} />;
            })}
            {d.none > 0 && (() => {
              const a0 = (acc / segTotal) * 360;
              return <path d={ringArc(c.x, c.y, r, a0, 360)} fill="none" stroke="#3A424D" strokeWidth={(isSel || isHov ? 4 : 3) / z} />;
            })()}
          </>
        ) : n > 0 ? (
          <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={segs[0] ? fc(segs[0][0]) : "#3A424D"} strokeWidth={(isSel || isHov ? 4 : 3) / z} />
        ) : null}
        {isSel && <circle cx={c.x} cy={c.y} r={r + 5 / z} fill="none" stroke={T.accent} strokeWidth={1 / z} strokeDasharray={`${3 / z} ${3 / z}`} />}
        {c.kind === "sect" ? (
          <rect x={c.x - 4 / z} y={c.y - 4 / z} width={8 / z} height={8 / z} transform={`rotate(45 ${c.x} ${c.y})`}
            fill={n > 0 ? T.panelHi : T.bg} stroke={isSel || isHov ? T.accent : T.muted} strokeWidth={1.2 / z} />
        ) : c.kind === "city" ? (
          <circle cx={c.x} cy={c.y} r={3.2 / z} fill={n > 0 ? T.ink : T.faint} stroke={T.bg} strokeWidth={0.8 / z} />
        ) : null}
        {(allLabels || n >= Math.max(1, Math.ceil(3 / z)) || isSel || isHov) && (() => {
          const off = { n: [0, -r - 7 / z], s: [0, r + 15 / z], e: [r + 6 / z, 4 / z], w: [-r - 6 / z, 4 / z] }[c.la || "e"];
          return (
            <text x={c.x + off[0]} y={c.y + off[1]} textAnchor={c.la === "e" ? "start" : c.la === "w" ? "end" : "middle"}
              style={{ fontFamily: serif, fontSize: (isSel || isHov ? 12.5 : 11) / z, fill: isSel || isHov ? T.ink : T.muted, paintOrder: "stroke", stroke: T.bg, strokeWidth: 3 / z }}>
              {name}{n > 0 ? ` ${n}` : ""}
            </text>
          );
        })()}
      </g>
    );
  };

  /* 離圖框：羅盤方位小匣，域外遠地之歸處 */
  const OffBox = ({ dir }) => {
    const names = offNames[dir].filter((nm) => (spots.m[nm]?.n || 0) > 0 || allLabels);
    if (names.length === 0) return null;
    const b = offBoxes[dir];
    const anchor = dir === "西" ? "start" : "end";
    return (
      <g>
        <text x={b.x} y={b.y - 14} textAnchor={anchor} style={{ fontFamily: serif, fontSize: 10.5, fill: T.faint, letterSpacing: "0.3em" }}>
          {dir === "西" ? "◁ 絕域之西" : "絕域之東 ▷"}
        </text>
        {names.map((nm, i) => {
          const n = spots.m[nm]?.n || 0;
          const isSel = sel === nm, isHov = hover === nm;
          const y = b.y + i * 24;
          const seg = spots.m[nm] ? Object.entries(spots.m[nm].tally).sort((a, c) => c[1] - a[1])[0] : null;
          return (
            <g key={nm} style={{ cursor: n > 0 ? "pointer" : "default", opacity: n > 0 ? 1 : 0.35 }}
              onMouseEnter={() => { if (!coarse) setHover(nm); }}
              onMouseLeave={() => { if (!coarse) setHover(null); }}
              onClick={() => { if (movedRef.current > 5) return; if (n > 0) setSel(sel === nm ? null : nm); }}>
              <rect x={dir === "西" ? b.x : b.x - 92} y={y - 13} width={92} height={19}
                fill={isSel ? T.panelHi : "none"} stroke={isSel || isHov ? T.accent : T.line} strokeWidth={1} />
              <text x={dir === "西" ? b.x + 6 : b.x - 6} y={y} textAnchor={anchor}
                style={{ fontFamily: serif, fontSize: 11, fill: seg ? fc(seg[0]) : T.muted }}>
                {nm}{n > 0 ? ` ${n}` : ""}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const selCoord = sel && sel !== NOLOC_KEY ? LOC_COORDS[sel] : null;

  return (
    <div>
      {/* 一級：門派及同級標籤 */}
      <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
        <Chip active={fsel === "all"} onClick={() => { setFsel("all"); setWho("all"); }} label={`全部 ${EVENTS.length}`} />
        {facList.main.map(({ f, n }) => (
          <Chip key={f} active={fsel === f} onClick={() => { setFsel(fsel === f ? "all" : f); setWho("all"); }} label={`${f} ${n}`} />
        ))}
        {facList.ethnic.length > 0 && (
          <Chip active={fsel === ETH_GROUP || facList.ethnic.some((x) => x.f === fsel)}
            onClick={() => { setFsel(fsel === ETH_GROUP ? "all" : ETH_GROUP); setWho("all"); }} label="【族属/地属】" />
        )}
        {facList.none > 0 && (
          <Chip active={fsel === NONE_FAC} onClick={() => { setFsel(fsel === NONE_FAC ? "all" : NONE_FAC); setWho("all"); }} label={`门派未标 ${facList.none}`} />
        )}
      </div>
      {/* 族屬傘形展開之次級標籤 */}
      {fsel === ETH_GROUP && (
        <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
          {facList.ethnic.map(({ f, n }) => (
            <Chip key={f} active={false} onClick={() => { setFsel(f); setWho("all"); }} label={`${f} ${n}`} />
          ))}
        </div>
      )}
      {facList.ethnic.some((x) => x.f === fsel) && (
        <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontFamily: serif, color: T.faint }}>【族属/地属】·</span>
          <Chip active={true} onClick={() => setFsel(ETH_GROUP)} label={fsel} />
        </div>
      )}
      {/* 二級：人物 */}
      {fsel !== "all" && subPersons.length > 0 && (
        <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontFamily: serif, color: T.faint }}>屬下之人 ·</span>
          <Chip active={who === "all"} onClick={() => setWho("all")} label="不限" />
          {subPersons.map((id) => (
            <Chip key={id} active={who === id} onClick={() => setWho(who === id ? "all" : id)} label={byId[id].name} />
          ))}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="檢索事名、人物、地點、門派、年號"
            style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: "3px", color: T.ink, fontSize: 12.5, fontFamily: serif, padding: "5px 10px 5px 32px", outline: "none", minWidth: 200 }} />
          <SearchTag />
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: serif, color: T.muted }}>計入 {shown.length} 事 · {Object.keys(spots.m).length} 地</span>
        <Chip active={allLabels} onClick={() => setAllLabels(!allLabels)} label="地名全顯" />
        {spots.noloc > 0 && (
          <button onClick={() => setSel(sel === NOLOC_KEY ? null : NOLOC_KEY)}
            style={{ fontSize: 11.5, fontFamily: serif, color: sel === NOLOC_KEY ? T.ink : T.faint, background: "none", border: `1px dashed ${sel === NOLOC_KEY ? T.accent : T.faint}`, padding: "2px 10px", borderRadius: "3px", cursor: "pointer" }}>
            無地點 {spots.noloc} 事
          </button>
        )}
      </div>
      {/* 時間滑桿：全程／累積至／僅當年 */}
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontFamily: serif, color: T.faint }}>時間 ·</span>
        <Chip active={tmode === "all"} onClick={() => setTmode("all")} label="全程" />
        <Chip active={tmode === "cum"} onClick={() => setTmode("cum")} label="累積至" />
        <Chip active={tmode === "year"} onClick={() => setTmode("year")} label="僅當年" />
        {tmode !== "all" && (
          <>
            <input type="range" min={YR.min} max={YR.max} value={tyear} onChange={(e) => setTyear(+e.target.value)}
              style={{ width: 280, accentColor: T.accent, verticalAlign: "middle" }} />
            <span style={{ fontFamily: serif, fontSize: 14, color: T.ink }}>
              {tyear}
              <span style={{ fontSize: 12, color: T.muted }}>{eraOf(tyear) ? `（${eraOf(tyear)}）` : ""}</span>
            </span>
          </>
        )}
      </div>
      {/* 動線選人行：點選即顯，至多三人並比 */}
      <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontFamily: serif, color: T.faint }}>動線（點選即顯，至多三人）·</span>
        {trackSel.length > 0 && (
          <button onClick={() => setTrackSel([])}
            style={{ fontSize: 11.5, fontFamily: serif, color: T.muted, background: "none", border: `1px solid ${T.line}`, padding: "2px 10px", cursor: "pointer" }}>
            清空
          </button>
        )}
        {trackables.map((id) => {
          const ti = trackSel.indexOf(id);
          return (
            <button key={id} onClick={() => toggleTrack(id)}
              style={{ fontSize: 12, fontFamily: serif, padding: "2px 10px", cursor: "pointer", background: ti >= 0 ? T.panelHi : "none", color: ti >= 0 ? TRACK_COLORS[ti] : T.muted, border: `1px solid ${ti >= 0 ? TRACK_COLORS[ti] : T.line}`, borderRadius: "3px" }}>
              {byId[id].name}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexDirection: narrow ? "column" : "row" }}>
        {/* 圖幅 */}
        <div style={{ flex: "1 1 auto", minWidth: 0, border: `1px solid ${T.line}`, background: T.panel, position: "relative" }}>
          <ZoomBtns view={view} zoomBy={zoomBy} reset={reset} />
          <svg viewBox="0 0 1000 720"
            style={{ width: "100%", display: "block", ...gestureStyle }}
            {...handlers}>
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {/* 襯底：觸屏點空處即收起動線浮框 */}
            <rect x={-4000} y={-4000} width={9000} height={9000} fill="transparent"
              onClick={() => { if (movedRef.current > 5) return; setHoverSeg(null); }} />
            {/* 底圖：示意手繪 */}
            <path d={GEO_BASE.coast} fill="none" stroke={T.muted} strokeWidth={1.3} opacity={0.55} vectorEffect="non-scaling-stroke" />
            <path d={GEO_BASE.north} fill="none" stroke={T.faint} strokeWidth={1} strokeDasharray="6 5" opacity={0.6} vectorEffect="non-scaling-stroke" />
            <path d={GEO_BASE.tubo} fill="none" stroke={T.faint} strokeWidth={1} strokeDasharray="6 5" opacity={0.6} vectorEffect="non-scaling-stroke" />
            <path d={GEO_BASE.huanghe} fill="none" stroke="#5B7A93" strokeWidth={1.4} opacity={0.55} vectorEffect="non-scaling-stroke" />
            <path d={GEO_BASE.changjiang} fill="none" stroke="#5B7A93" strokeWidth={1.4} opacity={0.55} vectorEffect="non-scaling-stroke" />
            {GEO_BASE.labels.map((l) => (
              <text key={l.t} x={l.x} y={l.y} textAnchor="middle"
                style={{ fontFamily: serif, fontSize: 13, fill: T.faint, letterSpacing: "0.5em", opacity: 0.65 }}>{l.t}</text>
            ))}
            {/* 泛稱面先繪（襯底），點位後繪 */}
            {Object.keys(LOC_COORDS).filter((nm) => LOC_COORDS[nm].kind === "region").map((nm) => <Spot key={nm} name={nm} />)}
            {Object.keys(LOC_COORDS).filter((nm) => LOC_COORDS[nm].kind === "city" || LOC_COORDS[nm].kind === "sect").map((nm) => <Spot key={nm} name={nm} />)}
            {/* 第二期：人物動線 —— 弧線僅表先後曾在，非循此路行；虛線段居間有無地點之事 */}
            {tracks.map((t) => {
              const sh = (t.ti - (tracks.length - 1) / 2) * 6 / view.k; /* 多線並比微錯位，免駐點疊死 */
              const P = (p) => [p.x + sh, p.y + sh * 0.6];
              return (
                <g key={t.id} style={{ cursor: "pointer" }} onClick={() => { if (movedRef.current > 5) return; onOpenChar(byId[t.id]); }}>
                  {t.stays.map((s, i) => {
                    if (i === 0) return null;
                    const [ax, ay] = P(t.stays[i - 1]), [bx, by] = P(s);
                    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
                    const bow = Math.min(len * 0.22, 34) * (i % 2 ? 1 : -1); /* 弓向交替，往返不疊 */
                    const cx = (ax + bx) / 2 - (dy / len) * bow, cy = (ay + by) / 2 + (dx / len) * bow;
                    const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
                    const segHov = hoverSeg && hoverSeg.ti === t.ti && hoverSeg.i === i;
                    const onSegMove = (ev2) => {
                      const box = ev2.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
                      setHoverSeg({ ti: t.ti, i, x: ev2.clientX - box.left, y: ev2.clientY - box.top, w: box.width, color: t.color, name: byId[t.id].name, prev: t.stays[i - 1], s });
                    };
                    return (
                      <g key={i}>
                        <path d={d} fill="none" stroke={T.bg} strokeWidth={(segHov ? 4.8 : 3.6) / view.k} opacity={0.7} />
                        <path d={d} fill="none" stroke={t.color} strokeWidth={(segHov ? 2.8 : 1.7) / view.k}
                          opacity={segHov ? 1 : hoverSeg ? 0.3 : 0.9}
                          strokeDasharray={s.gapBefore ? `${5 / view.k} ${4 / view.k}` : undefined} />
                        {/* 觸屏指腹粗於鼠尖，感應帶加寬一倍有餘 */}
                        <path d={d} fill="none" stroke="transparent" strokeWidth={(coarse ? 26 : 12) / view.k} style={{ pointerEvents: "stroke" }}
                          onMouseEnter={(ev2) => { if (!coarse) onSegMove(ev2); }}
                          onMouseMove={(ev2) => { if (!coarse) onSegMove(ev2); }}
                          onMouseLeave={() => { if (!coarse) setHoverSeg(null); }}
                          /* 觸屏無懸停：輕觸此段即浮出繫此段之事，不轉開檔案——檔案由駐點與人名承接 */
                          onClick={(ev2) => { if (!coarse) return; ev2.stopPropagation(); if (movedRef.current > 5) return; onSegMove(ev2); }} />
                      </g>
                    );
                  })}
                  {t.stays.map((s, i) => {
                    const [x, y] = P(s);
                    return <circle key={"n" + i} cx={x} cy={y} r={3.2 / view.k} fill={t.color} stroke={T.bg} strokeWidth={1 / view.k} />;
                  })}
                  {t.locLabels.map(([loc, g]) => {
                    const [x, y] = P(g);
                    return (
                      <text key={loc} x={x + 6 / view.k} y={y + (15 + t.ti * 11) / view.k}
                        style={{ fontFamily: serif, fontSize: 9.5 / view.k, fill: t.color, paintOrder: "stroke", stroke: T.bg, strokeWidth: 2.5 / view.k }}>
                        {g.visits.join("、")}
                      </text>
                    );
                  })}
                  {t.stays[0] && (() => {
                    const [x, y] = P(t.stays[0]);
                    return (
                      <text x={x - 7 / view.k} y={y - 7 / view.k} textAnchor="end"
                        style={{ fontFamily: serif, fontSize: 11.5 / view.k, fill: t.color, fontWeight: 700, paintOrder: "stroke", stroke: T.bg, strokeWidth: 3 / view.k }}>
                        {byId[t.id].name}（起）
                      </text>
                    );
                  })()}
                </g>
              );
            })}
            </g>
            <OffBox dir="西" />
            <OffBox dir="東" />
            {/* 圖例 */}
            <g transform="translate(34, 620)">
              <circle cx={6} cy={0} r={3.2} fill={T.ink} /><text x={16} y={4} style={{ fontFamily: serif, fontSize: 10.5, fill: T.muted }}>實名城邑</text>
              <rect x={2} y={20} width={8} height={8} transform="rotate(45 6 24)" fill={T.panelHi} stroke={T.muted} strokeWidth={1} /><text x={16} y={28} style={{ fontFamily: serif, fontSize: 10.5, fill: T.muted }}>門派駐地／自設地</text>
              <ellipse cx={6} cy={48} rx={9} ry={5} fill={T.faint} opacity={0.25} stroke={T.line} strokeDasharray="2 3" /><text x={16} y={52} style={{ fontFamily: serif, fontSize: 10.5, fill: T.muted }}>區域泛稱（事件計入面心）</text>
              <text x={0} y={76} style={{ fontFamily: serif, fontSize: 10.5, fill: T.faint }}>環徑按事件數開方縮放；一地多門派以門派色分段。</text>
              <text x={0} y={92} style={{ fontFamily: serif, fontSize: 10.5, fill: T.faint }}>底圖為示意手繪，方位可據、比例不稱。動線由事件推導、兼採作者訂正之補點，</text>
              <text x={0} y={108} style={{ fontFamily: serif, fontSize: 10.5, fill: T.faint }}>僅表先後曾在、非循此路行；虛線段居間有無地點之事；駐點注「序·年」。</text>
            </g>
          </svg>
          {/* 動線悬浮框：繫此段之事——到達之首見；標題逾百字截斷，全文由側欄承接 */}
          {hoverSeg && (() => {
            const flip = hoverSeg.x > hoverSeg.w * 0.55;
            const ttl = hoverSeg.s.ev.title;
            /* 觸屏改浮於指上方，免為指腹所掩 */
            const tf = [flip ? "translateX(-100%)" : "", coarse ? "translateY(-100%)" : ""].filter(Boolean).join(" ");
            return (
              <div style={{ position: "absolute", left: hoverSeg.x + (flip ? -14 : 14), top: hoverSeg.y + (coarse ? -14 : 12), transform: tf || "none", maxWidth: 300, background: T.panelHi, border: `1px solid ${T.line}`, boxShadow: "0 4px 18px rgba(0,0,0,.45)", padding: "10px 13px", pointerEvents: "none", zIndex: 4 }}>
                <div style={{ fontFamily: serif, fontSize: 12.5, color: hoverSeg.color, marginBottom: 4 }}>
                  {hoverSeg.name} · {hoverSeg.prev.loc}（迄{hoverSeg.prev.toYear ?? "起"}）→ {hoverSeg.s.loc}（{hoverSeg.s.year ?? "起"}）
                </div>
                {hoverSeg.s.gapBefore && (
                  <div style={{ fontFamily: serif, fontSize: 11, color: T.faint, marginBottom: 4 }}>其間有無地點之事，故弧作虛線。</div>
                )}
                <div style={{ fontFamily: serif, fontSize: 12.5, color: T.ink, lineHeight: 1.75 }}>
                  <span style={{ color: T.muted, fontSize: 11.5 }}>（{eraOf(hoverSeg.s.ev.year)}{hoverSeg.s.ev.month != null ? ` ${CN_MONTH[hoverSeg.s.ev.month]}` : ""}）</span>
                  {ttl.length > 100 ? ttl.slice(0, 100) + "……" : ttl}
                </div>
                <div style={{ fontFamily: serif, fontSize: 10.5, color: T.faint, marginTop: 5 }}>繫此段者為到達之首見，未必為位移之因；全文點駐地開側欄。</div>
              </div>
            );
          })()}
        </div>
        {/* 側欄：選中地之編年 */}
        {sel && (
          <div style={{ flex: narrow ? "1 1 auto" : "0 0 360px", width: narrow ? "100%" : 360, maxHeight: narrow ? "none" : 640, overflowY: "auto", border: `1px solid ${T.line}`, background: T.panel, padding: "14px 16px 6px 20px" }}>
            <div className="flex items-baseline" style={{ gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: serif, fontSize: 17, color: T.ink, fontWeight: 700 }}>
                {sel === NOLOC_KEY ? "無地點之事" : sel}
              </span>
              <span style={{ fontFamily: serif, fontSize: 12, color: T.muted }}>{selEvents.length} 事</span>
              <button onClick={() => setSel(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: T.faint, fontSize: 16, cursor: "pointer" }}>×</button>
            </div>
            {selCoord && selCoord.note && (
              <div style={{ fontFamily: serif, fontSize: 11.5, color: T.faint, marginBottom: 8 }}>按：{selCoord.note}。</div>
            )}
            <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, marginLeft: 40 }}>
              {selEvents.map((e, i) => {
                const showYear = i === 0 || selEvents[i - 1].year !== e.year;
                return <EvRow key={i} e={e} showYear={showYear} onOpenChar={onOpenChar} />;
              })}
              {selEvents.length === 0 && (
                <div style={{ fontFamily: serif, fontSize: 12.5, color: T.faint, padding: "10px 0 20px" }}>當前篩選下此地無事。</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 主應用 ---------------- */
export default function CangyunWiki() {
  /* 路由：哈希為唯一事實源（見 router.js 體例）。寫入即改哈希，
     hashchange（含瀏覽器前進後退）回灌 state；nav 同步 setHash 一份，
     免事件異步間隙內連續導航取到舊值——事件再至時值相同，React 自行免渲染 */
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const route = useMemo(() => parseRoute(hash), [hash]);
  const nav = (patch, replace = false) => {
    const h = routeHash({ ...route, ...patch });
    if (h === hash) return;
    setHash(h);
    if (replace) window.history.replaceState(null, "", h);
    else window.location.hash = h;
  };
  const tab = route.tab;
  const openChar = route.char ? byId[route.char] || null : null; /* 壞 id 鏈接：不開彈窗、不作報錯 */
  const setTab = (k) => nav({ tab: k });
  const setOpenChar = (c) => nav({ char: c ? c.id : null });
  const [faction, setFaction] = useState("全部");
  const [q, setQ] = useState("");

  const factions = ["全部", ...new Set(CHARACTERS.flatMap((c) => c.belong))];
  const shown = CHARACTERS.filter(
    (c) =>
      (faction === "全部" || c.belong.includes(faction)) &&
      (q === "" ||
        c.name.includes(q) ||
        (c.zi || "").includes(q) ||
        (c.epithet || "").includes(q) ||
        (c.pin || "").includes(q) ||
        (c.birthplace || "").includes(q))
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, padding: "0 0 60px" }}>
      <header style={{ borderBottom: `1px solid ${T.line}`, padding: "34px 28px 22px", display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.5em", color: T.faint }}>七一五 — 八〇〇 · 開元三年至貞元十六年</div>
          <h1 style={{ fontFamily: serif, fontSize: 34, fontWeight: 700, margin: "6px 0 0", letterSpacing: "0.08em" }}>
            人山人海 <span style={{ color: T.accent }}>·</span> 檔案
          </h1>
        </div>
        <nav style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {[["chars", "人物檔案"], ["timeline", "事件年表"], ["map", "山河輿圖"], ["network", "行星關係圖"], ["community", "群像網絡"], ["novel", "文庫"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ fontFamily: serif, fontSize: 15, padding: "8px 18px", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.accent}` : "2px solid transparent", color: tab === k ? T.ink : T.muted, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 0" }}>
        {tab === "chars" && (
          <>
            <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 20 }}>
              {factions.map((f) => (
                <Chip key={f} active={faction === f} onClick={() => setFaction(f)} label={f} />
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ position: "relative", display: "inline-block" }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="檢索姓名、表字、概覽、品評"
                  style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: "3px", color: T.ink, fontSize: 13, fontFamily: serif, padding: "6px 12px 6px 34px", outline: "none", minWidth: 220 }} />
                <SearchTag />
              </span>
            </div>
            <div className="char-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", columnGap: 14 }}>
              {shown.map((c) => (
                <CharCard key={c.id} c={c} onOpen={setOpenChar} />
              ))}
            </div>
            {shown.length === 0 && (
              <div style={{ color: T.faint, fontFamily: serif, padding: 40, textAlign: "center" }}>無合於此檢索之檔案。</div>
            )}
          </>
        )}
        {tab === "timeline" && <Timeline onOpenChar={setOpenChar} />}
        {tab === "network" && <Planetary onOpenChar={setOpenChar} />}
        {tab === "map" && <GeoMap onOpenChar={setOpenChar} />}
        {tab === "community" && <Community onOpenChar={setOpenChar} />}
        {tab === "novel" && <NovelReader path={route.novelPath} onNav={(p, replace) => nav({ novelPath: p }, replace)} />}
      </main>

      <DetailPanel c={openChar} onClose={() => setOpenChar(null)} onOpenChar={setOpenChar}
        onOpenNovel={(p) => nav({ tab: "novel", novelPath: p })} />
    </div>
  );
}
