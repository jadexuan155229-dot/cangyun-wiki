import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { serif, T, useNarrow } from "./theme";
import { NOVELS, FLAT } from "./novel";
import { CHAR_TERMS, scanCharTerms } from "./novel/char-terms";
import { fc, CHARACTERS } from "./cangyun-data";

/* ============================================================
   文庫 · 正文閱讀器
   左：目錄（故事線可折疊，卷之下再折疊）；右：正文。
   章節繫於路由 #/novel/<線>/<章>[/<子章>]（props: path / onNav）；
   閱讀位置另存 localStorage——初訪 #/novel 無章時回上次章節。
   ============================================================ */
const POS_KEY = "cangyun-wenku-pos";
const byPath = Object.fromEntries(FLAT.map((f) => [f.path, f]));
const wc = (t) => (t ? t.replace(/\s/g, "").length : 0);

/* 角色名點選：詞條與識別邏輯在 novel/char-terms.js（多詞條遍歷、長詞優先）。
   只在純文本片段內精確匹配、拆分文本節點渲染，
   不觸碰檢索高亮命中段與段落結構；命中處化為可點 span——默認同正文，
   hover／鍵盤聚焦／批注打開時現門派色細虛下劃線，點擊或 Enter/Space 開右側頁邊批注 */
/* 各角色強調色：取首屬門派之 fc 色（高垣→凌雪閣凝血玄絳），經 --char-accent 注入 CSS */
const TERM_ACCENT = Object.fromEntries(
  CHAR_TERMS.map(({ id }) => {
    const c = CHARACTERS.find((x) => x.id === id);
    return [id, fc(c && c.belong[0])];
  })
);
function splitCharTerms(s, keyBase, onCharClick, activeKey) {
  const segs = scanCharTerms(s);
  if (!segs) return s;
  return segs.map((g) => {
    if (g.text != null) return g.text;
    const k = `${keyBase}@${g.at}`;
    return (
      <span key={k} className={`nvl-char${activeKey === k ? " nvl-char--open" : ""}`}
        role="button" tabIndex={0} style={{ "--char-accent": TERM_ACCENT[g.id] }}
        onClick={(e) => onCharClick(g.id, k, e.currentTarget)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCharClick(g.id, k, e.currentTarget); } }}>
        {g.term}
      </span>
    );
  });
}

/* 正文體例：一行一段，段首縮進兩字；空行為節間距
   hl：檢索關鍵詞——命中處以淺橘紅半透明底標出（拆分文本節點渲染，不用 innerHTML）；
   firstHitRef：全文首個命中 span 之 ref，供檢索結果點入後平滑滾動定位 */
function Body({ text, hl, firstHitRef, onCharClick, activeCharKey }) {
  if (!text) {
    return <div style={{ fontFamily: serif, fontSize: 14, color: T.faint, padding: "36px 0", letterSpacing: "0.15em" }}>正文待錄。</div>;
  }
  const out = [];
  let gap = false;
  let firstHit = true;
  const kl = hl ? hl.toLowerCase() : "";
  text.split("\n").forEach((raw, i) => {
    const l = raw.trim();
    if (!l) { gap = true; return; }
    let content = splitCharTerms(l, i, onCharClick, activeCharKey);
    if (kl && l.toLowerCase().includes(kl)) {
      const ll = l.toLowerCase(), seg = [];
      let at = 0, p;
      while ((p = ll.indexOf(kl, at)) !== -1) {
        if (p > at) seg.push(splitCharTerms(l.slice(at, p), `${i}:${at}`, onCharClick, activeCharKey));
        seg.push(
          <span key={p} ref={firstHit ? firstHitRef : undefined}
            style={{ background: `${T.accent}55`, borderRadius: 2 }}>{l.slice(p, p + kl.length)}</span>
        );
        firstHit = false;
        at = p + kl.length;
      }
      if (at < l.length) seg.push(splitCharTerms(l.slice(at), `${i}:${at}`, onCharClick, activeCharKey));
      content = seg;
    }
    out.push(
      <p key={i} style={{ fontFamily: serif, fontSize: 15.5, color: T.ink, lineHeight: 2.1, margin: gap ? "1.5em 0 0" : "0.4em 0 0", textIndent: "2em" }}>{content}</p>
    );
    gap = false;
  });
  return <div>{out}</div>;
}

const navBtn = {
  fontFamily: serif, fontSize: 12.5, color: T.muted, background: "none",
  border: `1px solid ${T.line}`, padding: "6px 14px", cursor: "pointer", maxWidth: "48%", textAlign: "left",
};

/* 頁邊批注卡（原型）：fixed 錨定於被點角色名所在行，置正文欄右側批注區——書籍旁注之意。
   引導線沿名字下劃線高度延至正文右邊界，卡左緣同色小圓點續接對應。
   空間降級（不重排正文、不改正文寬度）：
     批注區足容整卡（room ≥ 卡寬+12）→ 旁注位；
     不足但壓正文可控（≤60px）→ 吸附視口右緣；
     再不足（窄視口）→ 退為貼名字上下的小 popover，無引導線。
   不佔文檔流、不鎖滾動、無遮罩；關閉：Esc、點卡外、頁面滾動逾 24px、視口改變。
   （正文中角色名不觸發「點外關閉」——點之為移位重開，交 onClick 處理） */
const NOTE_W = 260, NOTE_EDGE = 12, NOTE_GAP = 12, NOTE_OVERLAP_MAX = 60;
/* 引導線與卡緣圓點著色：門派色向白提亮少許、再帶半透明——深底上不沉沒，仍守門派色相；
   只涉眉批視覺，角色名下劃線仍用原色 --char-accent */
const noteInk = (hex, lift = 0.25, alpha = 0.5) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * lift));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
};
function MarginNote({ peek, bodyColRef, onClose }) {
  const c = CHARACTERS.find((x) => x.id === peek.id);
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null); /* { left, top, leader, dotTop }；null = 隱身量高中 */

  /* 定位：先以固定寬隱身渲染量得實高，繪製前同步算位——無閃跳 */
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const vw = window.innerWidth, vh = window.innerHeight, a = peek.anchor;
    const W = el.offsetWidth, H = el.offsetHeight;
    const bodyRight = bodyColRef.current ? bodyColRef.current.getBoundingClientRect().right : a.right;
    const room = vw - NOTE_EDGE - bodyRight;
    let left, top, leader = null, dotTop = null;
    if (room >= W - NOTE_OVERLAP_MAX) {
      left = room >= W + NOTE_GAP ? bodyRight + NOTE_GAP : vw - NOTE_EDGE - W;
      top = Math.max(NOTE_EDGE, Math.min(a.top - 2, vh - NOTE_EDGE - H));
      const y = a.bottom - 3, x1 = a.right + 5, x2 = Math.min(bodyRight, left - 1);
      if (x2 - x1 > 8) leader = { x: x1, y, w: x2 - x1 };
      dotTop = Math.max(6, Math.min(y - top - 2, H - 11)); /* 圓點循引導線高度、限卡內 */
    } else {
      left = Math.max(NOTE_EDGE, Math.min(a.left - 8, vw - NOTE_EDGE - W));
      top = a.bottom + 8 + H <= vh - NOTE_EDGE ? a.bottom + 8 : Math.max(NOTE_EDGE, a.top - 8 - H);
    }
    setPos({ left, top, leader, dotTop });
  }, [peek, bodyColRef]);

  useEffect(() => {
    const startY = window.scrollY; /* 每次移錨重記起點 */
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (cardRef.current && !cardRef.current.contains(t) && !t.closest(".nvl-char")) onClose();
    };
    const onScroll = () => { if (Math.abs(window.scrollY - startY) > 24) onClose(); };
    const onResize = () => onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [peek, onClose]);

  if (!c) return null;
  const accent = TERM_ACCENT[peek.id] || T.accent;
  /* 批注文案：人工編輯之 readerNote 優先、原樣不截斷（長度作者自控，卡有 maxHeight+內滾兜底）；
     缺此字段則回退 profile「官职身份」段摘要 */
  const note = (c.readerNote || "").trim();
  const intro = ((c.profile && c.profile[0] && c.profile[0][1]) || "").trim();
  const brief = note || (intro.length > 110 ? `${intro.slice(0, 110)}……` : intro);
  const years = c.birth || c.death ? `${c.birth ?? "？"} – ${c.death ?? "？"}` : "";
  return (
    <>
      {pos && pos.leader && (
        <div aria-hidden="true" style={{
          position: "fixed", left: pos.leader.x, top: pos.leader.y, width: pos.leader.w, height: 1,
          background: `repeating-linear-gradient(90deg, ${noteInk(accent)} 0 3px, transparent 3px 6px)`,
          pointerEvents: "none", zIndex: 29, animation: "nvl-note-in .18s ease-out",
        }} />
      )}
      {pos && pos.dotTop != null && (
        <div aria-hidden="true" style={{
          position: "fixed", left: pos.left - 2, top: pos.top + pos.dotTop, width: 5, height: 5,
          borderRadius: "50%", background: noteInk(accent), pointerEvents: "none", zIndex: 31,
          animation: "nvl-note-in .18s ease-out",
        }} />
      )}
      <aside ref={cardRef} role="dialog" aria-label={`${c.name} 档案批注`}
        style={{
          position: "fixed", zIndex: 30, width: Math.min(NOTE_W, window.innerWidth - 2 * NOTE_EDGE),
          left: pos ? pos.left : 0, top: pos ? pos.top : 0, visibility: pos ? "visible" : "hidden",
          maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
          background: T.panel, border: `1px solid ${T.line}`, boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
          padding: "14px 16px 16px", animation: pos ? "nvl-note-in .18s ease-out" : "none",
        }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, color: T.ink }}>{c.name}</span>
          {c.zi && <span style={{ fontFamily: serif, fontSize: 12, color: T.muted }}>字 {c.zi}</span>}
          {c.hao && <span style={{ fontFamily: serif, fontSize: 11.5, color: T.faint }}>「{c.hao}」</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {(c.belong.length ? c.belong : ["门派待补"]).map((f) => (
            <span key={f} style={{ fontFamily: serif, fontSize: 11, color: fc(f), border: `1px solid ${fc(f)}55`, padding: "1px 8px", borderRadius: 2 }}>{f}</span>
          ))}
        </div>
        {years && (
          <div style={{ fontFamily: serif, fontSize: 11, color: T.faint, marginTop: 8 }}>{years}{c.birthplace ? ` · ${c.birthplace}` : ""}</div>
        )}
        {brief && (
          <p style={{ fontFamily: serif, fontSize: 12, color: T.muted, lineHeight: 1.9, margin: "10px 0 0", textIndent: "2em" }}>{brief}</p>
        )}
      </aside>
    </>
  );
}

export default function NovelReader({ path, onNav }) {
  const narrow = useNarrow();
  /* 章節由路由派生（#/novel/…，見 router.js）；壞路徑同無章 */
  const sel = path && byPath[path] ? path : null;
  /* 初訪 #/novel 無章：回上次閱讀處（replace 寫入不佔歷史，後退不折返）；
     繪製前替換，不閃目錄頁。僅掛載時恢復——後退回 #/novel 目錄頁不得再彈回 */
  useLayoutEffect(() => {
    if (!sel) {
      const s = localStorage.getItem(POS_KEY);
      if (s && byPath[s]) onNav(s, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* 初始折疊：僅展開當前章所在之線（及卷）；此後隨章節更替增開（見 sel 效應） */
  const [expanded, setExpanded] = useState(() => {
    const next = new Set();
    if (sel) {
      const p = sel.split("/");
      next.add(p[0]);
      if (p.length === 3) next.add(`${p[0]}/${p[1]}`);
    }
    return next;
  });
  const [tocOpen, setTocOpen] = useState(false); /* 窄屏目錄抽屜 */
  const [peek, setPeek] = useState(null); /* 頁邊批注（原型僅高垣）：{ id, key: 錨點span鍵, anchor: 點擊時視口矩形 } */
  const closePeek = useCallback(() => setPeek(null), []); /* 引用穩定：免批注卡監聽器隨父渲染反復掛卸 */
  const openPeek = useCallback((id, key, el) => {
    /* 錨點取末段矩形：名字折行時循尾字之行，下劃線與引導線同高 */
    const rs = el.getClientRects();
    const r = rs.length ? rs[rs.length - 1] : el.getBoundingClientRect();
    setPeek({ id, key, anchor: { top: r.top, right: r.right, bottom: r.bottom, left: r.left } });
  }, []);
  const bodyColRef = useRef(null); /* 正文 714 欄 wrapper：批注定位取其右邊界 */
  const [tocHover, setTocHover] = useState(null); /* 目錄懸停項 → hover 輕浮起 */
  const [q, setQ] = useState(""); /* 目錄檢索：書目（線名／書題）、卷題、篇章題；空則完整目錄 */
  const [inputValue, setInputValue] = useState(""); /* 檢索框顯示值：IME 組詞期間僅更新顯示、不觸發篩選 */
  const [isComposing, setIsComposing] = useState(false); /* 中文輸入法組詞中標記 */
  const firstHitEl = useRef(null);    /* 正文首個命中 span */
  const pendingScroll = useRef(false); /* 檢索結果點入後待滾動至命中處 */
  const hoverable = (k, base) => ({
    onMouseEnter: () => setTocHover(k),
    onMouseLeave: () => setTocHover((h) => (h === k ? null : h)),
    style: {
      ...base,
      transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
      ...(tocHover === k ? { background: "rgba(255,255,255,0.035)", transform: "translateX(5px) translateY(-1px) scale(1.018)", boxShadow: "0 6px 18px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.035)", borderRadius: "4px" } : {}),
    },
  });

  useEffect(() => {
    if (sel) localStorage.setItem(POS_KEY, sel);
  }, [sel]);
  /* 章節更替（含瀏覽器前進後退）：關批注（舊錨點座標隨正文更替失效）、展開所在線／卷 */
  useEffect(() => {
    setPeek(null);
    if (!sel) return;
    const p = sel.split("/");
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(p[0]);
      if (p.length === 3) next.add(`${p[0]}/${p[1]}`);
      return next;
    });
  }, [sel]);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  /* 選章 = 寫路由 + 收抽屜 + 回頁首（自檢索結果入章時不回頁首，改滾至命中處）；
     展開線／卷與關批注繫於 sel 效應，瀏覽器前進後退同得 */
  const jump = (path, toTop = true) => {
    onNav(path);
    setTocOpen(false);
    if (toTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openResult = (path) => {
    if (path === sel) {
      if (firstHitEl.current) firstHitEl.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    pendingScroll.current = true;
    jump(path, false);
  };
  useEffect(() => {
    if (pendingScroll.current) {
      pendingScroll.current = false;
      if (firstHitEl.current) firstHitEl.current.scrollIntoView({ behavior: "smooth", block: "center" });
      else window.scrollTo({ top: 0, behavior: "smooth" }); /* 僅標題命中、正文無命中：回頁首 */
    }
  }, [sel]);

  /* 全文檢索：字面匹配、不分英文大小寫、不作正則；每篇章至多一條結果 */
  const results = useMemo(() => {
    const k = q.trim();
    if (!k) return [];
    const kl = k.toLowerCase();
    const out = [];
    for (const f of FLAT) {
      const titleHit = [f.novel.tag, f.novel.title, f.group && f.group.title, f.ch.title]
        .some((t) => t && t.toLowerCase().includes(kl));
      const text = f.ch.text || "";
      const tl = text.toLowerCase();
      let n = 0, first = -1, at = 0, p;
      while ((p = tl.indexOf(kl, at)) !== -1) { if (first < 0) first = p; n++; at = p + kl.length; }
      if (!titleHit && n === 0) continue;
      let snip = null;
      if (first >= 0) { /* 摘要：命中前後各截約 28 字，截斷處以省略號示之 */
        const s = Math.max(0, first - 28), e = Math.min(text.length, first + k.length + 28);
        snip = {
          pre: (s > 0 ? "…" : "") + text.slice(s, first).replace(/\s+/g, " "),
          hit: text.slice(first, first + k.length),
          post: text.slice(first + k.length, e).replace(/\s+/g, " ") + (e < text.length ? "…" : ""),
        };
      }
      out.push({ f, n, snip });
    }
    return out;
  }, [q]);

  const cur = sel ? byPath[sel] : null;
  const idx = cur ? FLAT.findIndex((f) => f.path === sel) : -1;
  const prevCh = idx > 0 ? FLAT[idx - 1] : null;
  const nextCh = idx >= 0 && idx < FLAT.length - 1 ? FLAT[idx + 1] : null;
  /* 正文欄寬：於舒適閱讀寬度基礎上微調 +5%，避免個別長句提早換行；仍遠窄於標題下分隔線 */
  const bodyMaxWidth = 714;
  /* 跨線翻頁帶線名，入卷帶卷名 */
  const navLabel = (f) =>
    `${!cur || f.novel.id !== cur.novel.id ? `【${f.novel.tag}】` : ""}${f.group ? `${f.group.title} · ` : ""}${f.ch.title}`;

  const Leaf = ({ nv, group, ch }) => {
    const path = group ? `${nv.id}/${group.id}/${ch.id}` : `${nv.id}/${ch.id}`;
    const active = sel === path;
    const n = wc(ch.text);
    return (
      <button onClick={() => jump(path)}
        {...hoverable(path, {
          display: "flex", width: "100%", alignItems: "baseline", background: "none", border: "none",
          borderLeft: active ? `2px solid ${T.accent}` : "2px solid transparent",
          padding: `4px 8px 4px ${group ? 44 : 30}px`, cursor: "pointer", textAlign: "left",
        })}>
        <span style={{ fontFamily: serif, fontSize: 14, color: active ? T.ink : n ? T.muted : T.faint, lineHeight: 1.7 }}>{ch.title}</span>
        {n > 0 && <span style={{ marginLeft: "auto", fontFamily: serif, fontSize: 10, color: T.faint, paddingLeft: 8 }}>{n} 字</span>}
      </button>
    );
  };

  const Tree = () => {
    const k = q.trim(); /* 檢索中：命中項與其必要上級保留；命中之上級則子項全示；展開態強制打開、原折疊狀態不動 */
    return (
    <div>
      {NOVELS.map((nv) => {
        const nvHit = !k || nv.tag.includes(k) || nv.title.includes(k);
        const kids = nvHit ? nv.chapters : nv.chapters.filter((ch) =>
          ch.chapters ? ch.title.includes(k) || ch.chapters.some((s) => s.title.includes(k)) : ch.title.includes(k));
        if (k && !nvHit && kids.length === 0) return null;
        const open = !!k || expanded.has(nv.id);
        return (
          <div key={nv.id} style={{ marginBottom: 4 }}>
            <button onClick={() => toggle(nv.id)}
              {...hoverable(nv.id, { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 8px 5px", cursor: "pointer" })}>
              <span style={{ color: T.accent, fontSize: 11, width: 15, display: "inline-block" }}>{open ? "▾" : "▸"}</span>
              <span style={{ fontFamily: serif, fontSize: 14.5, color: open ? T.ink : T.muted }}>【{nv.tag}】</span>
              <span style={{ fontFamily: serif, fontSize: 13.5, color: open ? T.muted : T.faint }}>{nv.title}</span>
            </button>
            {open && kids.map((ch) => {
              if (!ch.chapters) return <Leaf key={ch.id} nv={nv} ch={ch} />;
              const gk = `${nv.id}/${ch.id}`;
              const gOpen = !!k || expanded.has(gk);
              const subs = !k || nvHit || ch.title.includes(k) ? ch.chapters : ch.chapters.filter((s) => s.title.includes(k));
              return (
                <div key={ch.id}>
                  <button onClick={() => toggle(gk)}
                    {...hoverable(gk, { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "4px 8px 4px 22px", cursor: "pointer" })}>
                    <span style={{ color: T.accent, fontSize: 10, width: 14, display: "inline-block" }}>{gOpen ? "▾" : "▸"}</span>
                    <span style={{ fontFamily: serif, fontSize: 14, color: gOpen ? T.ink : T.muted }}>{ch.title}</span>
                    <span style={{ fontFamily: serif, fontSize: 10, color: T.faint, marginLeft: 6 }}>卷</span>
                  </button>
                  {gOpen && subs.map((sub) => <Leaf key={sub.id} nv={nv} group={ch} ch={sub} />)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    );
  };

  /* 檢索結果視圖：一篇章一條——所屬書目／卷、篇題、含關鍵詞之正文摘要；點入滾至首個命中處 */
  const SearchResults = () => (
    <div>
      {results.length === 0 && (
        <div style={{ fontFamily: serif, fontSize: 12, color: T.faint, padding: "14px 8px", letterSpacing: "0.1em" }}>未检得相关文字</div>
      )}
      {results.map(({ f, n, snip }) => (
        <button key={f.path} onClick={() => openResult(f.path)}
          {...hoverable(`sr:${f.path}`, {
            display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
            borderLeft: sel === f.path ? `2px solid ${T.accent}` : "2px solid transparent",
            padding: "6px 8px 7px 10px", cursor: "pointer",
          })}>
          <div style={{ fontFamily: serif, fontSize: 10.5, color: T.faint }}>
            【{f.novel.tag}】{f.group ? ` ${f.group.title}` : ""}{n > 1 ? ` · 命中 ${n} 处` : ""}
          </div>
          <div style={{ fontFamily: serif, fontSize: 12.5, color: T.ink, lineHeight: 1.6, marginTop: 1 }}>{f.ch.title}</div>
          {snip && (
            <div style={{ fontFamily: serif, fontSize: 11, color: T.muted, lineHeight: 1.8, marginTop: 3 }}>
              {snip.pre}<span style={{ color: T.accent }}>{snip.hit}</span>{snip.post}
            </div>
          )}
        </button>
      ))}
    </div>
  );

  /* 寬屏側欄目錄，樣式對齊年表「分段目錄」 */
  const Toc = () => (
    <div className="toc-scroll" style={{ width: 216, flexShrink: 0, position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", overflowX: "hidden", paddingRight: 12 }}>
      {/* 目錄縱向滾動條深色化：僅作用於 .toc-scroll，不及全站 */}
      <style>{`
.toc-scroll{scrollbar-width:thin;scrollbar-color:#5B6470 #171B21}
.toc-scroll::-webkit-scrollbar{width:8px}
.toc-scroll::-webkit-scrollbar-track{background:#171B21}
.toc-scroll::-webkit-scrollbar-thumb{background:#5B6470;border-radius:4px}
.toc-scroll::-webkit-scrollbar-thumb:hover{background:#788493}
`}</style>
      <div style={{ fontSize: 10.5, letterSpacing: "0.4em", color: T.faint, margin: "0 0 10px 8px" }}>文庫目錄</div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); if (!isComposing) setQ(e.target.value); }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => { setIsComposing(false); setInputValue(e.currentTarget.value); setQ(e.currentTarget.value); }}
          placeholder="检索书目、篇章"
          style={{ display: "block", width: "100%", background: T.panel, border: `1px solid ${T.line}`, color: T.ink, fontSize: 12.5, fontFamily: serif, padding: "5px 10px 5px 32px", outline: "none", borderRadius: "3px" }} />
        <span style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 18, display: "flex", alignItems: "center", justifyContent: "center", background: T.accent, color: "#E7E2D6", fontSize: 11, fontFamily: serif, borderRadius: "3px", pointerEvents: "none" }}>查</span>
      </div>
      {q.trim() !== "" ? <SearchResults /> : <Tree />}
    </div>
  );

  /* 窄屏：目錄退化為頂部抽屜 */
  const NarrowToc = () => (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: T.bg, borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
      <button onClick={() => setTocOpen(!tocOpen)}
        style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%", background: "none", border: "none", padding: "10px 4px", cursor: "pointer", textAlign: "left" }}>
        <span style={{ color: T.accent, fontSize: 11 }}>{tocOpen ? "▾" : "▸"}</span>
        <span style={{ fontFamily: serif, fontSize: 13.5, color: T.ink }}>
          {cur ? `【${cur.novel.tag}】${cur.group ? `${cur.group.title} · ` : ""}${cur.ch.title}` : "文庫目錄"}
        </span>
      </button>
      {tocOpen && <div style={{ paddingBottom: 10, maxHeight: "60vh", overflowY: "auto" }}><Tree /></div>}
    </div>
  );

  return (
    <div>
      {/* 角色名可點樣式與批注淡入：默認同正文無異，虛線常備而色透明——hover／鍵盤聚焦／批注打開時
          僅變色為門派色（--char-accent 自 span 內聯注入），無版式抖動 */}
      <style>{`
.nvl-char{cursor:pointer;text-decoration-line:underline;text-decoration-style:dashed;text-decoration-color:transparent;text-decoration-thickness:1px;text-underline-offset:5px}
.nvl-char:hover,.nvl-char:focus-visible,.nvl-char--open{text-decoration-color:var(--char-accent);outline:none}
@keyframes nvl-note-in{from{opacity:0}to{opacity:1}}
`}</style>
      {narrow && <NarrowToc />}
      <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
        {/* 以 Toc() 內聯而非 <Toc/>：Toc 每渲染重定義，作組件用會令 React 視為新類型而整棵重掛，銷毀檢索框 DOM、中斷 IME 組詞 */}
        {!narrow && Toc()}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!cur ? (
            <div style={{ padding: "90px 20px", textAlign: "center" }}>
              <div style={{ fontFamily: serif, fontSize: 15, color: T.muted, letterSpacing: "0.25em" }}>自目錄擇章而入</div>
              <div style={{ fontFamily: serif, fontSize: 12, color: T.faint, marginTop: 14 }}>凡 {NOVELS.length} 線 · 閱讀位置自動保存</div>
            </div>
          ) : (
            <div>
              <div style={{ maxWidth: bodyMaxWidth }}>
                <div style={{ fontSize: 11, letterSpacing: "0.4em", color: T.faint }}>【{cur.novel.tag}】{cur.novel.title}</div>
                <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: T.ink, margin: "10px 0 0", letterSpacing: "0.06em" }}>
                  {cur.group ? `${cur.group.title} · ` : ""}{cur.ch.title}
                </h2>
                {wc(cur.ch.text) > 0 && (
                  <div style={{ fontFamily: serif, fontSize: 11, color: T.faint, marginTop: 8 }}>{wc(cur.ch.text)} 字</div>
                )}
              </div>
              {/* 分隔線寬屏獨立展寬：左端探入目錄與正文間的留白，右端對齊年表主區寬度；正文欄自身寬度不隨之改變 */}
              <div style={narrow
                ? { borderTop: `1px solid ${T.line}`, marginTop: 16 }
                : { borderTop: `1px solid ${T.line}`, marginTop: 16, marginLeft: -26, width: "calc(100% + 26px)", maxWidth: 1026 }} />
              {/* 正文主區：寬屏時以 1000（分隔線右端對齊基準）為界，正文欄在此界內水平置中，與靠左的標題各自獨立留邊 */}
              <div style={narrow ? undefined : { maxWidth: 1000 }}>
                <div ref={bodyColRef} style={{ maxWidth: bodyMaxWidth, paddingTop: 22, ...(narrow ? null : { marginLeft: "auto", marginRight: "auto" }) }}>
                  <Body text={cur.ch.text} hl={q.trim() || null} firstHitRef={firstHitEl} onCharClick={openPeek} activeCharKey={peek ? peek.key : null} />
                </div>
                <div style={{ maxWidth: bodyMaxWidth, display: "flex", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${T.line}`, marginTop: 44, paddingTop: 14, ...(narrow ? null : { marginLeft: "auto", marginRight: "auto" }) }}>
                  {prevCh ? <button onClick={() => jump(prevCh.path)} style={navBtn}>‹ {navLabel(prevCh)}</button> : <span />}
                  {nextCh ? <button onClick={() => jump(nextCh.path)} style={navBtn}>{navLabel(nextCh)} ›</button> : <span />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {peek && <MarginNote peek={peek} bodyColRef={bodyColRef} onClose={closePeek} />}
    </div>
  );
}
