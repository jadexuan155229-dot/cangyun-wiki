/* ============================================================
   首頁定場 (landing.jsx) —— 燭照尋卷
   裸址直達時的入站定場：一屏近黑，光標（觸屏為指尖）是一團燭光，
   照到哪裡，哪裡的遠山與弧面輿圖自暗中顯影；朱印「入卷」鈐下即入站。
   全部畫面程序繪製（Canvas 2D），不引一圖一庫：
   · 輿圖紋理復用 GEO_BASE 手繪 path 與 LOC_COORDS 城邑坐標；
   · 兩道變換作「書頁弧面」：逐行透視壓縮（遠密近疏）＋ 逐列拱面上抬
     （地平成弧、界格成緯線，弧面之立由此二者）；
   · 洛陽、太原作大城，雁門作關城，餘作小城，立體如棋子置枰上；
   · 深鏈直達與同會話再訪皆不攔（見 App.jsx wantLanding）。
   層序（下→上）：遠山天幕 / 弧面輿圖（皆可視差平移，故四緣各留
   40/20px 出血）→ 掩暗層（燭光在此鑿孔，不平移、恰滿視口）→
   雲、月、燭暈、題字、朱印、提示（暗上之物，開屏即見）。
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { GEO_BASE, LOC_COORDS } from "./cangyun-data.js";
import { serif, useCoarsePointer } from "./theme.js";

/* ---------------- 輿圖紋理 ---------------- */

const S = 3;   /* 紋理超采樣倍率：機位低則近行放大逾五倍，2× 已不敷用 */
const M = 140; /* 紋理四緣留白：遠行取材寬逾 1000 圖幅，出界即穿幫 */

/* 棋子名單：kind 定畫法（big 兩重簷大城 / pass 關城 / small 譙樓小城） */
const FEATURED = [
  ["洛阳", "big"], ["太原府", "big"],
  ["长安", "capital"],
  ["雁门关", "pass"],
  ["云州-云中", "small"], ["潼关", "small"],
  ["河北-范阳", "small"], ["河北-常山", "small"], ["邺城", "small"],
  ["睢阳", "small"], ["灵武", "small"],
];
const SHOWN_NAME = { "太原府": "太原", "云州-云中": "云州" };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 山字紋一列：兩筆勾峰、一筆側皴，沿走向散佈 */
function inkRange(ctx, rnd, x0, y0, x1, y1, n) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = x0 + (x1 - x0) * t + (rnd() - 0.5) * 16;
    const y = y0 + (y1 - y0) * t + (rnd() - 0.5) * 12;
    const w = 5 + rnd() * 5, h = 4 + rnd() * 4.5;
    ctx.strokeStyle = "rgba(86,98,112,0.5)"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.85, x, y - h);
    ctx.quadraticCurveTo(x + w * 0.25, y - h * 0.55, x + w, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(86,98,112,0.28)";
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + w * 0.05, y - h * 0.45, x + w * 0.32, y);
    ctx.stroke();
  }
}

let texCache = null;
function mapTexture() {
  if (texCache) return texCache;
  const W = 1000 + M * 2, H = 720 + M * 2;
  const cv = document.createElement("canvas");
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext("2d");
  ctx.scale(S, S);
  /* 紙底：墨色微暖，斑駁作舊 */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#161A20"); bg.addColorStop(0.5, "#181C23"); bg.addColorStop(1, "#14181E");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rnd = mulberry32(7);
  for (let i = 0; i < 72; i++) {
    const x = rnd() * W, y = rnd() * H, r = 24 + rnd() * 72;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() > 0.5 ? "rgba(150,132,100,0.05)" : "rgba(70,82,98,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  /* 界格：橫線經弧面變換即成緯弧，是弧面成立的主要視覺線索 */
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(122,134,152,0.06)";
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(122,134,152,0.035)";
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  ctx.translate(M, M); /* 以下入輿圖 1000×720 坐標系 */
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const P = (d) => new Path2D(d);
  /* 域面淡染（平盧、東海、淮揚、蜀中…） */
  for (const c of Object.values(LOC_COORDS)) {
    if (c.kind !== "region") continue;
    ctx.fillStyle = "rgba(96,108,124,0.07)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.rx || 30, c.ry || 20, ((c.rot || 0) * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
  }
  /* 海岸實線、二界虛線、二河雙鉤 */
  ctx.strokeStyle = "#4C5868"; ctx.lineWidth = 2.2; ctx.stroke(P(GEO_BASE.coast));
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "rgba(94,106,122,0.55)"; ctx.lineWidth = 1.4;
  ctx.stroke(P(GEO_BASE.north)); ctx.stroke(P(GEO_BASE.tubo));
  ctx.setLineDash([]);
  for (const d of [GEO_BASE.huanghe, GEO_BASE.changjiang]) {
    ctx.strokeStyle = "rgba(62,82,104,0.85)"; ctx.lineWidth = 3; ctx.stroke(P(d));
    ctx.strokeStyle = "rgba(110,134,160,0.65)"; ctx.lineWidth = 1.1; ctx.stroke(P(d));
  }
  /* 群山底勢：陰山、燕山、呂梁、太行、秦嶺 */
  inkRange(ctx, rnd, 556, 208, 662, 200, 9);
  inkRange(ctx, rnd, 700, 226, 762, 206, 7);
  inkRange(ctx, rnd, 628, 302, 646, 246, 6);
  inkRange(ctx, rnd, 668, 318, 696, 236, 9);
  inkRange(ctx, rnd, 538, 372, 652, 368, 10);
  /* 道名題注 */
  ctx.fillStyle = "rgba(112,122,136,0.55)";
  ctx.font = `15px ${serif}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const L of GEO_BASE.labels) ctx.fillText(L.t, L.x, L.y);
  /* 城邑墨點與門派菱標（棋子另畫於弧面之上，此為底圖印痕） */
  for (const c of Object.values(LOC_COORDS)) {
    if (c.kind === "city") {
      ctx.fillStyle = "rgba(130,140,155,0.5)";
      ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2); ctx.fill();
    } else if (c.kind === "sect") {
      ctx.strokeStyle = "rgba(130,140,155,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 3); ctx.lineTo(c.x + 3, c.y); ctx.lineTo(c.x, c.y + 3); ctx.lineTo(c.x - 3, c.y);
      ctx.closePath(); ctx.stroke();
    }
  }
  texCache = cv;
  return cv;
}

/* ---------------- 弧面幾何 ----------------
   由畫布尺寸導出一次，帶面繪製、遠山與棋子落點共用同一套變換。
   視點壓低偏右：地平不作水平線——左緣為山勢所侵、低垂至 0.58h，
   右緣揚至 0.385h（城池多聚中右，深處讓與右側），中段再加拱面 bump，
   遠端界線遂成一道斜掠的弧。 */
function mkGeom(w, h) {
  const yLft = h * 0.58, yRgt = h * 0.385;
  const arcH = Math.max(20, Math.min(50, h * 0.055));
  const arcAt = (x) => arcH * Math.max(0, 1 - Math.pow((x - w * 0.52) / (w * 0.62), 2));
  /* 地平微波：直線加弧仍嫌僵，疊兩道低頻細浪（±5px），
     圖緣、氣靄、微光、山腳共用此函數，起伏自動一致，如手繪圖緣 */
  const wave = (x) => 3.2 * Math.sin((x / w) * Math.PI * 3.4 + 0.9) + 1.8 * Math.sin((x / w) * Math.PI * 6.6 + 2.1);
  const hor = (x) => yLft + (yRgt - yLft) * (x / w) - arcAt(x) + wave(x);
  let minHor = Infinity;
  for (let x = 0; x <= w; x += 8) minHor = Math.min(minHor, hor(x));
  const bandH = h - minHor;                                 /* 最高列亦須鋪到視口底 */
  /* 剪裁窗：以 x=650（洛陽—太原豎軸）為中心，縱取北疆至江淮 */
  const cropCX = 650, cropY0 = 140, cropH = 340;
  const cropW = Math.max(250, Math.min(430, cropH * (w / bandH) * 0.52));
  /* 逐行透視：d∈[0,1] 自地平至帶底，V 為輿圖縱向取樣位。機位貼近桌面，
     遠端壓得極扁、近端放得極大；線性項保底，免帶底放大發散 */
  const V = (d) => 0.16 * d + 0.84 * (1 - Math.pow(1 - d, 3.1));
  /* 行寬：遠行取材寬（地物顯小、盡收於帶）、近行取材窄（地物顯大、如在目前） */
  const visW = (d) => cropW * (1.62 - 1.02 * d);
  /* V 之逆（棋子落點反推屏上行位）：V 單調，查表折半 */
  const N = 256, tab = [];
  for (let i = 0; i <= N; i++) tab.push(V(i / N));
  const D = (v) => {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < v) lo = m; else hi = m; }
    return (lo + (v - tab[lo]) / (tab[hi] - tab[lo])) / N;
  };
  const toDest = (sx, sy) => {
    const v = (sy - cropY0) / cropH;
    if (v < 0.03 || v > 1) return null;
    const d = D(v);
    const x = w / 2 + ((sx - cropCX) / visW(d)) * w;
    if (x < -30 || x > w + 30) return null;
    return { x, y: hor(x) + d * bandH, d };
  };
  return { w, h, hor, minHor, arcH, bandH, cropCX, cropY0, cropH, V, visW, toDest };
}

/* ---------------- 三重山脊 ----------------
   一次生成折線，遠山填充與燙金脊線兩處共用（脊線浮於掩暗層上，
   暗中亦見山之輪廓；燭光照到，填充山體恰在其下對位顯出）。
   峰取鐘形（餘弦鐘），諸峰以 p-範數軟極大相接——峰頂圓融、
   峰谷無折角，輪廓柔和不作鋒稜。後高前低、左盛右衰：
   侵左緣、讓右地，右尾漸平、收作圖緣一線。pts 為 [x, y, 峰高]。 */
function makeRidges(g, w, h) {
  const rnd = mulberry32(20260805);
  /* fadeC>0：脊線隨峰高淡出（後山右尾不與前緣線疊亮）；0＝整線連描。
     fixed：定製峰——最左一組主次分明（次高 · 高 · 矮），隨機峰自 u0 起補勢。
     gTop/gBot：山體立面漸變（脊上月色微明、山腳沉暗）；haze：罩霧，益遠益濃 */
  const defs = [
    {
      off: 4, n: 5, u0: 0.27, hMin: 0.14, hMax: 0.3, wMin: 0.07, wMax: 0.15,
      gTop: "#28323F", gBot: "#1B232D", haze: 0.1, rim: 0.2, fadeC: 14,
      fixed: [{ u: 0.03, hf: 0.29, wf: 0.082 }, { u: 0.125, hf: 0.4, wf: 0.112 }, { u: 0.205, hf: 0.2, wf: 0.072 }],
    },
    {
      off: 7, n: 6, u0: 0, hMin: 0.09, hMax: 0.19, wMin: 0.06, wMax: 0.12,
      gTop: "#1E2732", gBot: "#161D27", haze: 0.05, rim: 0.3, fadeC: 12,
      fixed: [{ u: 0.06, hf: 0.15, wf: 0.09 }],
    },
    {
      off: 10, n: 5, u0: 0, hMin: 0.05, hMax: 0.11, wMin: 0.05, wMax: 0.1,
      gTop: "#151C25", gBot: "#0F151D", haze: 0, rim: 0.44, fadeC: 0, fixed: [],
    },
  ];
  return defs.map((R) => {
    /* 峰高皆兜坡度上限：豎屏窄而高，不設限則成針尖 */
    const peaks = R.fixed.map((F) => ({ cx: w * F.u, wid: w * F.wf, hgt: Math.min(h * F.hf, w * F.wf * 1.9) }));
    for (let i = 0; i < R.n; i++) {
      const cx = w * (R.u0 + (0.93 - R.u0) * Math.pow(rnd(), 0.8));   /* 佈點偏左 */
      const decay = 1 - 0.72 * Math.pow(cx / w, 1.25);                /* 愈右愈衰 */
      const wid = w * (R.wMin + (R.wMax - R.wMin) * rnd());
      peaks.push({ cx, wid, hgt: Math.min(h * (R.hMin + (R.hMax - R.hMin) * rnd()) * decay, wid * 1.9) });
    }
    const jp = rnd() * 6.3, jf = 0.008 + rnd() * 0.006;
    const p4 = rnd() * 6.3, p5 = rnd() * 6.3;
    const pts = [];
    for (let x = -2; x <= w + 2; x += 4) {
      let sum = 0;
      for (const P of peaks) {
        const t = Math.abs(x - P.cx) / P.wid;
        if (t < 1) sum += Math.pow(P.hgt * Math.pow(0.5 * (1 + Math.cos(Math.PI * t)), 1.15), 5);
      }
      let crest = Math.pow(sum, 1 / 5);
      crest += Math.sin(x * jf + jp) * Math.min(2.5, crest * 0.2); /* 微瀾隨峰勢，谷底歸零 */
      /* 細碎筆意：兩道高頻小噪疊在坡上，輪廓不作純函數的光滑 */
      crest += (1.6 * Math.sin(x * 0.043 + p4) + 1.0 * Math.sin(x * 0.107 + p5)) * Math.min(1, crest / 22);
      const hx = g.hor(Math.min(w, Math.max(0, x)));
      /* 脊不得垂入圖面（右尾峰高小於 off 時以 clamp 兜住） */
      pts.push([x, Math.min(hx - 1.5, hx + R.off - crest), crest]);
    }
    return { ...R, pts, peaks };
  });
}

/* ---------------- 城邑棋子 ----------------
   立體如棋子置枰上：落影貼枰、牆體分面、簷角反宇、門洞與窗牖留一點暖光。
   皆以 (x,y) 為腳底中點，s 為整體縮放。 */
const C = {
  wallMid: "#454D56", wallLight: "#535C66", wallTop: "#5D666F", wallDark: "#39414A",
  roof: "#272D34", roofLine: "#8A7350", ridge: "#4A525C", gate: "#0F1318",
};

function shadow(ctx, dx, dy, rx, ry) {
  ctx.fillStyle = "rgba(4,6,9,0.2)";
  ctx.beginPath(); ctx.ellipse(dx, dy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(4,6,9,0.28)";
  ctx.beginPath(); ctx.ellipse(dx, dy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2); ctx.fill();
}
/* 城面梯形：上邊略斂，見牆之收分 */
function wallFace(ctx, x0, x1, hTop, inset) {
  ctx.beginPath();
  ctx.moveTo(x0, 0); ctx.lineTo(x0 + inset, hTop); ctx.lineTo(x1 - inset, hTop); ctx.lineTo(x1, 0);
  ctx.closePath(); ctx.fill();
}
function merlons(ctx, x0, yTop, w, n) {
  ctx.fillStyle = C.wallTop;
  const step = w / n;
  for (let i = 0; i < n; i++) ctx.fillRect(x0 + i * step + step * 0.18, yTop - 2.4, step * 0.5, 2.4);
}
/* 中式簷頂：短脊反宇，簷口沿線與正脊各提一筆 */
function roofCN(ctx, cx, ridgeY, w, h) {
  const rw = w * 0.3, eY = ridgeY + h, f = w * 0.1 + 1.2;
  ctx.fillStyle = C.roof;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - f, eY - 1);
  ctx.quadraticCurveTo(cx - w / 2 + w * 0.16, eY - h * 0.28, cx - rw / 2, ridgeY);
  ctx.lineTo(cx + rw / 2, ridgeY);
  ctx.quadraticCurveTo(cx + w / 2 - w * 0.16, eY - h * 0.28, cx + w / 2 + f, eY - 1);
  ctx.quadraticCurveTo(cx, eY + h * 0.34, cx - w / 2 - f, eY - 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.roofLine; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - f, eY - 1);
  ctx.quadraticCurveTo(cx, eY + h * 0.34, cx + w / 2 + f, eY - 1);
  ctx.stroke();
  ctx.strokeStyle = C.ridge; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - rw / 2, ridgeY); ctx.lineTo(cx + rw / 2, ridgeY); ctx.stroke();
}
/* 角樓攢尖 */
function corner(ctx, cx, baseY, w, h) {
  ctx.fillStyle = C.wallLight;
  ctx.fillRect(cx - w / 2, baseY - h, w, h);
  ctx.fillStyle = C.roof;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 1.6, baseY - h);
  ctx.quadraticCurveTo(cx - w * 0.12, baseY - h - 3.4, cx, baseY - h - 5);
  ctx.quadraticCurveTo(cx + w * 0.12, baseY - h - 3.4, cx + w / 2 + 1.6, baseY - h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.roofLine; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 - 1.6, baseY - h); ctx.lineTo(cx + w / 2 + 1.6, baseY - h); ctx.stroke();
}
function gate(ctx, cx, baseY, w, h) {
  ctx.fillStyle = C.gate;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx - w / 2, baseY - h * 0.55);
  ctx.quadraticCurveTo(cx, baseY - h * 1.15, cx + w / 2, baseY - h * 0.55);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(217,164,91,0.7)"; /* 門洞深處一點燈火 */
  ctx.beginPath(); ctx.ellipse(cx, baseY - 1.4, w * 0.16, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
}
function win(ctx, x, y) {
  ctx.fillStyle = "rgba(217,164,91,0.9)";
  ctx.fillRect(x - 0.7, y - 0.9, 1.4, 1.8);
}

/* 大城（洛陽、太原）：外郭 + 角樓 + 兩重簷門樓 + 內城高閣 */
function drawBigCity(ctx, x, y, s) {
  /* 縱向多放 16%：機位貼近桌面，棋子見高，落影亦斜長 */
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * 1.16);
  shadow(ctx, 7, 1.5, 43, 7);
  ctx.fillStyle = C.wallMid; wallFace(ctx, -32, 32, -13, 1.5);
  ctx.fillStyle = C.wallTop; ctx.fillRect(-30.5, -15.2, 61, 2.4);
  merlons(ctx, -30, -15.2, 60, 9);
  corner(ctx, -27, -15.2, 7, 6);
  corner(ctx, 27, -15.2, 7, 6);
  /* 內城高閣，居左後錯落 */
  ctx.fillStyle = C.wallDark; ctx.fillRect(-21, -24, 12, 9);
  roofCN(ctx, -15, -30, 18, 5.5);
  /* 門樓兩重簷 */
  ctx.fillStyle = C.wallLight; ctx.fillRect(-8, -21, 16, 6);
  roofCN(ctx, 0, -27, 24, 6);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-5.5, -31, 11, 4);
  roofCN(ctx, 0, -36, 17, 5);
  gate(ctx, 0, 0, 7, 9);
  win(ctx, -3.2, -18); win(ctx, 3.4, -18); win(ctx, -15, -20.5); win(ctx, 0, -29);
  ctx.restore();
}
/* 都城（長安）：低垣廣展、臺基上三重簷高閣（含元殿意象）、兩翼雙闕——
   量感別於軍鎮大城與州縣小城：不恃牆高，而恃中軸崇樓 */
function drawCapital(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * 1.16);
  shadow(ctx, 6, 1.5, 34, 6);
  /* 外垣低而廣 */
  ctx.fillStyle = C.wallMid; wallFace(ctx, -28, 28, -7, 1.2);
  ctx.fillStyle = C.wallTop; ctx.fillRect(-26.8, -8.6, 53.6, 1.8);
  merlons(ctx, -26, -8.6, 52, 10);
  /* 兩翼雙闕 */
  ctx.fillStyle = C.wallLight; ctx.fillRect(-21.5, -17, 5, 8.4);
  roofCN(ctx, -19, -20.2, 9, 3.2);
  ctx.fillStyle = C.wallLight; ctx.fillRect(16.5, -17, 5, 8.4);
  roofCN(ctx, 19, -20.2, 9, 3.2);
  /* 臺基與三重簷高閣 */
  ctx.fillStyle = C.wallTop; ctx.fillRect(-12, -11, 24, 3);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-9, -17, 18, 6);
  roofCN(ctx, 0, -21.5, 26, 4.8);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-6.5, -25, 13, 3.6);
  roofCN(ctx, 0, -29.5, 20, 4.6);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-4.4, -32.6, 8.8, 3.2);
  roofCN(ctx, 0, -37, 14.5, 4.4);
  gate(ctx, 0, 0, 6, 7.5);
  win(ctx, -3.4, -14.5); win(ctx, 3.4, -14.5); win(ctx, 0, -23.3);
  win(ctx, -19, -13.5); win(ctx, 19, -13.5);
  ctx.restore();
}
/* 小城：單牆 + 譙樓 */
function drawSmallCity(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * 1.16);
  shadow(ctx, 4, 1, 18, 3.6);
  ctx.fillStyle = C.wallMid; wallFace(ctx, -12, 12, -6.5, 1);
  ctx.fillStyle = C.wallTop; ctx.fillRect(-11.4, -7.8, 22.8, 1.6);
  merlons(ctx, -11, -7.8, 22, 5);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-3.4, -12.5, 6.8, 5);
  roofCN(ctx, 0, -16.4, 11.4, 3.6);
  gate(ctx, 0, 0, 3.6, 4.4);
  win(ctx, 0, -10.4);
  ctx.restore();
}
/* 關城（雁門）：兩翼垛牆銜山，中起關樓 */
function peak(ctx, cx, baseY, w, h) {
  ctx.fillStyle = "#2A313A";
  ctx.beginPath();
  ctx.moveTo(cx - w, baseY);
  ctx.quadraticCurveTo(cx - w * 0.25, baseY - h * 0.72, cx, baseY - h);
  ctx.quadraticCurveTo(cx + w * 0.3, baseY - h * 0.6, cx + w, baseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#39424C"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - h);
  ctx.quadraticCurveTo(cx - w * 0.1, baseY - h * 0.4, cx - w * 0.25, baseY);
  ctx.stroke();
}
function drawPass(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * 1.16);
  shadow(ctx, 4, 1.2, 25, 4.2);
  peak(ctx, -26, 0, 9, 8); peak(ctx, 27, 0, 10, 9);
  ctx.fillStyle = C.wallMid;
  ctx.fillRect(-21, -5, 13, 5); ctx.fillRect(8, -5, 13, 5);
  merlons(ctx, -21, -5, 13, 3); merlons(ctx, 8, -5, 13, 3);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-8, -11, 16, 11);
  ctx.fillStyle = C.wallTop; ctx.fillRect(-8.6, -12.4, 17.2, 1.6);
  ctx.fillStyle = C.wallLight; ctx.fillRect(-6, -17.4, 12, 5);
  roofCN(ctx, 0, -21.8, 18, 4.5);
  gate(ctx, 0, 0, 4.5, 6);
  win(ctx, -3, -15); win(ctx, 3, -15);
  ctx.restore();
}

function pieceLabel(ctx, p, s) {
  const big = p.kind === "big" || p.kind === "capital";
  const t = SHOWN_NAME[p.name] ?? p.name.split("-").pop();
  ctx.font = `${big ? "600 13.5" : "11.5"}px ${serif}`;
  ctx.fillStyle = big ? "rgba(206,197,170,0.95)" : "rgba(152,162,174,0.85)";
  ctx.strokeStyle = "rgba(10,13,17,0.75)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
  /* 棋子實寬之半再讓數像素，名號不疊壓牆體簷角 */
  const halfW = (p.kind === "big" ? 76 : p.kind === "capital" ? 62 : p.kind === "pass" ? 58 : 27) * s * 0.5 + 8;
  let x = p.x, y = p.y - 6, align = "center";
  if (p.la === "e") { x += halfW; align = "left"; }
  else if (p.la === "w") { x -= halfW; align = "right"; }
  else if (p.la === "n") { y = p.y - (big ? 42 : 26) * s - 8; }
  else { y = p.y + 13; }
  ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.strokeText(t, x, y);
  ctx.fillText(t, x, y);
}

/* ---------------- 三層畫布 ---------------- */

/* 天幕與遠山：三重剪影沿斜地平鋪展，地平淡暈沉在山後 */
function paintFar(cv, w, h, g, ridges, dpr) {
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  /* 天幕滿鋪到底、下段回落至底色，免得填充下緣在暗中拉出一條直線接縫 */
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#090C11");
  sky.addColorStop(Math.min(1, (g.minHor * 0.72) / h), "#10141B");
  sky.addColorStop(Math.min(1, g.minHor / h), "#171A20");
  sky.addColorStop(Math.min(1, (g.minHor + 170) / h), "#0A0D12");
  sky.addColorStop(1, "#0A0D12");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  /* 地平淡暈（壓扁的 radial，月色沉在山後），置於斜弧中段偏右 */
  ctx.save();
  ctx.translate(w * 0.56, g.hor(w * 0.56) + 4); ctx.scale(1, 0.26);
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.52);
  gl.addColorStop(0, "rgba(196,172,124,0.08)"); gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(-w / 2, -w * 0.52, w, w * 1.04);
  ctx.restore();
  ridges.forEach((R, i) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-2, h);
      for (const [x, y] of R.pts) ctx.lineTo(x, y);
      ctx.lineTo(w + 2, h);
      ctx.closePath();
    };
    let top = Infinity;
    for (const p of R.pts) if (p[1] < top) top = p[1];
    ctx.save();
    path(); ctx.clip();
    /* 山體立面：脊上月色微明、山腳沉入濃暗（參考水彩山之體塊，非平塗剪影） */
    const gr = ctx.createLinearGradient(0, top, 0, h);
    gr.addColorStop(0, R.gTop); gr.addColorStop(0.85, R.gBot); gr.addColorStop(1, R.gBot);
    ctx.fillStyle = gr; ctx.fillRect(0, top - 4, w, h - top + 8);
    /* 水彩斑駁：明暗兩色暈點，山面有肌理 */
    const br = mulberry32(300 + i);
    for (let b = 0; b < 30; b++) {
      const bx = br() * w, by = top + br() * (h - top), r = 18 + br() * 60;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0, br() > 0.45 ? "rgba(148,160,180,0.05)" : "rgba(6,9,13,0.07)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    }
    /* 脊上月色：沿輪廓內側一道柔光 */
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    R.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "rgba(168,180,198,0.1)"; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = "rgba(180,192,210,0.14)"; ctx.lineWidth = 3.5; ctx.stroke();
    /* 大氣：後山罩霧，益遠益淡 */
    if (R.haze) { ctx.fillStyle = `rgba(96,108,126,${R.haze})`; ctx.fillRect(0, top - 4, w, h - top + 8); }
    ctx.restore();
  });
}

/* 燙金脊線與金脈：鋪在掩暗層之上，暗夜裡也見群山的走勢與筋骨。
   脊線描輪廓；金脈自峰頂沿山勢垂落、蜿蜒漸細漸淡（金繕之意——
   山有內在的褶皱裂理，不獨一根外輪廓），遇前山之影即止；
   燭照之下皆與山體對位相合 */
function paintRidgeRims(cv, w, h, ridges, g, dpr) {
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  /* 折線上按 x 取脊高（pts 步長 4、自 -2 起） */
  const yAt = (pts, x) => {
    const k = Math.max(0, Math.min(pts.length - 1, Math.round((x + 2) / 4)));
    return pts[k][1];
  };
  ridges.forEach((R, i) => {
    const front = ridges.slice(i + 1);
    const occl = (x) => {
      let m = Infinity;
      for (const F of front) m = Math.min(m, yAt(F.pts, x));
      return m;
    };
    /* 金脈：不作垂髮亂草，只畫山的骨架——
       支稜（spur）：自峰頂沿山腹長弧掃落，曲率平緩，如小一號的輪廓線；
       皴面（echo）：取輪廓一段向內錯位、循勢平行，如岩面褶理；
       皆平滑取點（解析參數，非逐步抖動）、兩端漸隱、遇前山之影即止 */
    const vr = mulberry32(1000 + i);
    const veinA = [0.22, 0.3, 0.4][i] ?? 0.3;
    const clampX = (x) => Math.max(0, Math.min(w, x));
    const drawFade = (line, aArr, w0) => {
      for (let s = 1; s < line.length; s++) {
        const a = (aArr[s - 1] + aArr[s]) / 2;
        if (a < 0.02) continue;
        ctx.strokeStyle = `rgba(214,182,105,${a})`;
        ctx.lineWidth = w0 * (1 - 0.4 * (s / line.length));
        ctx.beginPath();
        ctx.moveTo(line[s - 1][0], line[s - 1][1]);
        ctx.lineTo(line[s][0], line[s][1]);
        ctx.stroke();
      }
    };
    for (const P of R.peaks) {
      if (P.hgt < h * 0.08) continue;
      const tall = P.hgt > h * 0.16;
      /* 支稜：高峰兩條各奔一側，餘者一條 */
      const nSpur = tall ? 2 : 1;
      for (let v = 0; v < nSpur; v++) {
        const dir = nSpur === 2 ? (v === 0 ? -1 : 1) : (vr() < 0.5 ? -1 : 1);
        const x0 = P.cx + dir * P.wid * (0.02 + vr() * 0.08);
        const y0 = yAt(R.pts, x0) + 2;
        const room = Math.min(g.hor(clampX(x0)) - 8, occl(x0) - 4) - y0;
        if (room < 30) continue;
        const len = room * (0.55 + vr() * 0.3);
        const bow = P.wid * (0.35 + vr() * 0.3);
        const ph = vr() * 6.3;
        const line = [], aArr = [];
        const N = 26;
        for (let k = 0; k <= N; k++) {
          const t = k / N;
          const x = x0 + dir * bow * Math.pow(t, 1.5) + 2.2 * Math.sin(t * 5.2 + ph) * t;
          const y = y0 + len * t;
          if (y >= occl(x) - 3 || y >= g.hor(clampX(x)) - 6) break;
          line.push([x, y]);
          aArr.push(veinA * Math.pow(1 - t, 0.85));
        }
        if (line.length > 4) drawFade(line, aArr, 1.15);
      }
      /* 皴面：循輪廓錯位的平行段，錯位量沿途漸增，明暗作鐘形兩端漸隱 */
      if (P.hgt > h * 0.12) {
        const nEcho = tall ? 2 : 1;
        for (let e = 0; e < nEcho; e++) {
          const dir = vr() < 0.5 ? -1 : 1;
          const xs = P.cx + dir * P.wid * (0.12 + vr() * 0.1);
          const xe = P.cx + dir * P.wid * (0.55 + vr() * 0.3);
          const o0 = 7 + vr() * 8, grow = 10 + vr() * 14;
          const line = [], aArr = [];
          const N = 22;
          for (let k = 0; k <= N; k++) {
            const t = k / N;
            const x = xs + (xe - xs) * t;
            const y = yAt(R.pts, x) + o0 + grow * t;
            if (y >= occl(x) - 3 || y >= g.hor(clampX(x)) - 6) break;
            line.push([x, y]);
            aArr.push(veinA * 0.85 * Math.sin(Math.PI * Math.min(1, t)));
          }
          if (line.length > 4) drawFade(line, aArr, 1);
        }
      }
    }
    /* 脊線 */
    for (const [wd, aMul] of [[2.8, 0.32], [1.1, 1]]) {   /* 先柔暈後實線 */
      if (!R.fadeC) {
        /* 前山整線連描：右尾平伏，兼作圖緣鎏金邊 */
        ctx.beginPath();
        R.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = `rgba(219,187,110,${R.rim * aMul})`;
        ctx.lineWidth = wd; ctx.stroke();
      } else {
        /* 後山逐段描、隨峰高淡出，右尾不與前緣線疊成三重亮線 */
        for (let k = 1; k < R.pts.length; k++) {
          const a = Math.min(1, (R.pts[k - 1][2] + R.pts[k][2]) / 2 / R.fadeC);
          if (a < 0.03) continue;
          ctx.beginPath();
          ctx.moveTo(R.pts[k - 1][0], R.pts[k - 1][1]);
          ctx.lineTo(R.pts[k][0], R.pts[k][1]);
          ctx.strokeStyle = `rgba(219,187,110,${R.rim * aMul * a})`;
          ctx.lineWidth = wd; ctx.stroke();
        }
      }
    }
  });
}

/* 弧面輿圖：兩道變換 + 氣靄 + 弧沿微光 + 棋子 + 邊緣入暗 */
function paintMap(cv, w, h, g, dpr) {
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = "high";
  const tex = mapTexture();
  /* 第一道：逐行透視壓縮，先鋪成平置帶面 */
  const p1 = document.createElement("canvas");
  p1.width = Math.ceil(w * dpr); p1.height = Math.ceil(g.bandH * dpr);
  const c1 = p1.getContext("2d");
  c1.scale(dpr, dpr);
  c1.imageSmoothingQuality = "high";
  const step = 2;
  for (let yD = 0; yD < g.bandH; yD += step) {
    const v0 = g.V(yD / g.bandH), v1 = g.V(Math.min(1, (yD + step) / g.bandH));
    const vw = g.visW(yD / g.bandH);
    c1.drawImage(tex,
      (g.cropCX - vw / 2 + M) * S, (g.cropY0 + v0 * g.cropH + M) * S,
      vw * S, Math.max(1, (v1 - v0) * g.cropH * S),
      0, yD, w, step);
  }
  /* 第二道：逐列沿斜弧上抬 —— 遠端界線左低右揚，書頁斜捲 */
  for (let x = 0; x < w; x += 2) {
    ctx.drawImage(p1, x * dpr, 0, 2 * dpr, p1.height, x, g.hor(x + 1), 2, g.bandH);
  }
  /* 沿斜弧描線的小工具：氣靄與微光皆循同一道界 */
  const horPath = () => {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = g.hor(x) + 0.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  };
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  /* 氣靄：軟描數道、寬漸窄色漸實，貼弧而生、不留平直邊 */
  for (const [lw, a] of [[46, 0.02], [28, 0.03], [14, 0.045], [6, 0.06]]) {
    horPath(); ctx.strokeStyle = `rgba(148,158,175,${a})`; ctx.lineWidth = lw; ctx.stroke();
  }
  /* 弧沿一線微光——世界的邊 */
  horPath(); ctx.strokeStyle = "rgba(198,168,112,0.1)"; ctx.lineWidth = 3; ctx.stroke();
  horPath(); ctx.strokeStyle = "rgba(168,178,192,0.3)"; ctx.lineWidth = 1.2; ctx.stroke();
  /* 城邑棋子：遠者先畫、沒入氣靄，近者壓前 */
  const pieces = [];
  for (const [name, kind] of FEATURED) {
    const c = LOC_COORDS[name];
    const p = c && g.toDest(c.x, c.y);
    if (p) pieces.push({ name, kind, la: c.la, ...p });
  }
  pieces.sort((a, b) => a.y - b.y);
  const base = Math.max(0.95, Math.min(1.7, w / 1200));
  for (const p of pieces) {
    const s = base * (0.5 + 1.15 * p.d) * (p.kind === "big" ? 1.16 : p.kind === "capital" ? 1.12 : 1);
    ctx.globalAlpha = 0.66 + 0.34 * p.d;
    if (p.kind === "big") drawBigCity(ctx, p.x, p.y, s);
    else if (p.kind === "capital") drawCapital(ctx, p.x, p.y, s);
    else if (p.kind === "pass") drawPass(ctx, p.x, p.y, s);
    else drawSmallCity(ctx, p.x, p.y, s);
    pieceLabel(ctx, p, s);
    ctx.globalAlpha = 1;
  }
  /* 邊緣入暗：帶面左右與底沿沒入夜色 */
  const topY = g.minHor - 8;
  const ew = w * 0.15;
  let eg = ctx.createLinearGradient(0, 0, ew, 0);
  eg.addColorStop(0, "rgba(6,8,12,0.55)"); eg.addColorStop(1, "rgba(6,8,12,0)");
  ctx.fillStyle = eg; ctx.fillRect(0, topY, ew, h - topY);
  eg = ctx.createLinearGradient(w, 0, w - ew, 0);
  eg.addColorStop(0, "rgba(6,8,12,0.55)"); eg.addColorStop(1, "rgba(6,8,12,0)");
  ctx.fillStyle = eg; ctx.fillRect(w - ew, topY, ew, h - topY);
  eg = ctx.createLinearGradient(0, h - 80, 0, h);
  eg.addColorStop(0, "rgba(6,8,12,0)"); eg.addColorStop(1, "rgba(6,8,12,0.45)");
  ctx.fillStyle = eg; ctx.fillRect(0, h - 80, w, 80);
}

/* ---------------- 定場組件 ---------------- */

const DARK = 0.94;      /* 掩暗層底色不透明度：留 6% 微透，暗中略見山河輪廓 */
const TRAIL_MS = 1500;  /* 燭光行過之處，墨色徐徐合攏的時長 */

export default function Landing({ onEnter }) {
  const wrapRef = useRef(null);
  const farRef = useRef(null);
  const mapRef = useRef(null);
  const darkRef = useRef(null);
  const ridgeRef = useRef(null);
  const glowRef = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [moved, setMoved] = useState(false);
  const coarse = useCoarsePointer();
  const leavingRef = useRef(false);
  const doneRef = useRef(false);
  const enterRef = useRef(null);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onEnter();
  };
  const enter = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try { sessionStorage.setItem("cy-landing-seen", "1"); } catch { /* 私隱模式讀寫不得，無妨 */ }
    setLeaving(true);
    window.setTimeout(finish, 2400); /* 兜底：transitionend 不至也要放行 */
  };
  enterRef.current = enter;

  useEffect(() => {
    const wrap = wrapRef.current;
    const dark = darkRef.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const BLEED_X = 40, BLEED_Y = 20; /* 視差平移的出血量，與 .cy-scene 負位移一致 */
    let raf = 0, w = 0, h = 0;
    let skyLift = null; /* 暗中天光形版：天際線以上掩暗減淡，山成剪影 */
    const octx = dark.getContext("2d");

    /* 光與視差的活動量 */
    const st = {
      hx: 0, hy: 0,          /* 燭光現位（緩追） */
      tx: 0, ty: 0,          /* 燭光目標（指針或自巡） */
      px: 0, py: 0,          /* 視差歸一位（緩追） */
      tpx: 0, tpy: 0,
      trail: [],             /* {x,y,t} 行過之跡 */
      interacted: false,
      autoA: 1,              /* 自巡燭亮度：首次互動後淡出 */
      last: 0,
    };

    const build = () => {
      w = wrap.clientWidth; h = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const PW = w + BLEED_X * 2, PH = h + BLEED_Y * 2;
      const g = mkGeom(PW, PH);
      const ridges = makeRidges(g, PW, PH);
      paintFar(farRef.current, PW, PH, g, ridges, dpr);
      paintMap(mapRef.current, PW, PH, g, dpr);
      paintRidgeRims(ridgeRef.current, PW, PH, ridges, g, dpr);
      /* 暗中天光形版：三重山脊逐點取高為天際線，線上方微透天光——
         月夜之理：天有微明，山是比天更黑的剪影，非空心勾線。
         （scene 座標帶出血，轉視口座標須減 BLEED 位移） */
      skyLift = document.createElement("canvas");
      skyLift.width = w; skyLift.height = h;
      const sc = skyLift.getContext("2d");
      sc.beginPath();
      const pts0 = ridges[0].pts;
      for (let i = 0; i < pts0.length; i++) {
        let y = Infinity;
        for (const R of ridges) y = Math.min(y, R.pts[i][1]);
        const sx = pts0[i][0] - BLEED_X, sy = y - BLEED_Y;
        if (i === 0) sc.moveTo(sx, sy); else sc.lineTo(sx, sy);
      }
      sc.lineTo(w + 4, -4); sc.lineTo(-4, -4); sc.closePath();
      const sg = sc.createLinearGradient(0, 0, 0, h * 0.62);
      sg.addColorStop(0, "rgba(0,0,0,0.17)");
      sg.addColorStop(1, "rgba(0,0,0,0.11)");
      sc.fillStyle = sg; sc.fill();
      dark.width = w; dark.height = h;
      dark.style.width = `${w}px`; dark.style.height = `${h}px`;
      if (st.hx === 0 && st.hy === 0) {
        st.hx = st.tx = w * 0.5; st.hy = st.ty = h * 0.58;
      }
      paintDark(performance.now());
    };

    const punch = (x, y, r, a) => {
      const grd = octx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(0,0,0,${a})`);
      grd.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = grd;
      octx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const paintDark = (now) => {
      octx.clearRect(0, 0, w, h);
      octx.globalCompositeOperation = "source-over";
      octx.fillStyle = `rgba(7,9,13,${reduced ? 0.6 : DARK})`;
      octx.fillRect(0, 0, w, h);
      octx.globalCompositeOperation = "destination-out";
      if (skyLift) octx.drawImage(skyLift, 0, 0);
      const R = Math.max(170, Math.min(380, Math.min(w, h) * 0.3));
      if (reduced) {
        /* 減動效：一盞定燈照住畫心，不追不巡 */
        punch(w * 0.5, h * 0.58, R * 1.7, 0.92);
        octx.globalCompositeOperation = "source-over";
        return;
      }
      const t = now / 1000;
      st.trail = st.trail.filter((p) => now - p.t < TRAIL_MS);
      for (const p of st.trail) {
        const life = 1 - (now - p.t) / TRAIL_MS;
        punch(p.x, p.y, R * (0.3 + 0.45 * life), 0.85 * life);
      }
      const flick = 1 + 0.025 * Math.sin(t * 9.3) + 0.02 * Math.sin(t * 17.7);
      const headA = st.interacted ? 0.97 : 0.95 * st.autoA;
      if (headA > 0.02) punch(st.hx, st.hy, R * flick, headA);
      octx.globalCompositeOperation = "source-over";
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
      st.last = now;
      /* 未互動時燭火自巡，緩緩掠過山河 */
      if (!st.interacted) {
        const t = now / 1000;
        st.tx = w * (0.5 + 0.3 * Math.sin(t * 0.21));
        st.ty = h * (0.58 + 0.16 * Math.sin(t * 0.13 - 0.4));
      } else if (st.autoA > 0) {
        st.autoA = Math.max(0, st.autoA - dt * 0.8);
      }
      st.hx += (st.tx - st.hx) * 0.16;
      st.hy += (st.ty - st.hy) * 0.16;
      const lastP = st.trail[st.trail.length - 1];
      if (!lastP || Math.hypot(st.hx - lastP.x, st.hy - lastP.y) > 14) {
        st.trail.push({ x: st.hx, y: st.hy, t: now });
        if (st.trail.length > 40) st.trail.shift();
      }
      paintDark(now);
      /* 燭暈隨光，視差隨指 */
      if (glowRef.current) glowRef.current.style.transform = `translate3d(${st.hx}px,${st.hy}px,0)`;
      st.px += (st.tpx - st.px) * 0.06;
      st.py += (st.tpy - st.py) * 0.06;
      /* 脊線層與遠山層同步平移，燙金輪廓才與山體對位不脫 */
      const farT = `translate3d(${-st.px * 10}px,${-st.py * 5}px,0)`;
      if (farRef.current) farRef.current.style.transform = farT;
      if (ridgeRef.current) ridgeRef.current.style.transform = farT;
      if (mapRef.current) mapRef.current.style.transform = `translate3d(${-st.px * 22}px,${-st.py * 10}px,0)`;
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      st.interacted = true;
      st.tx = e.clientX; st.ty = e.clientY;
      st.tpx = (e.clientX / w) * 2 - 1;
      st.tpy = (e.clientY / h) * 2 - 1;
      setMoved(true);
    };
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === "Escape") enterRef.current?.();
    };
    const stopWheel = (e) => e.preventDefault(); /* 定場之下站內勿滾 */
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 160);
    };

    build();
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerdown", onMove);
    wrap.addEventListener("wheel", stopWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onMove);
      wrap.removeEventListener("wheel", stopWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={"cy-landing" + (leaving ? " cy-landing--leave" : "")}
      onTransitionEnd={(e) => { if (leavingRef.current && e.target === wrapRef.current) finish(); }}
      aria-label="入站定場：八千里路"
    >
      <canvas ref={farRef} className="cy-scene" aria-hidden="true" />
      <canvas ref={mapRef} className="cy-scene" aria-hidden="true" />
      <canvas ref={darkRef} className="cy-dark" aria-hidden="true" />
      <canvas ref={ridgeRef} className="cy-scene cy-ridge" aria-hidden="true" />
      <div className="cy-cloud cy-cloud--a" aria-hidden="true" />
      <div className="cy-cloud cy-cloud--b" aria-hidden="true" />
      <div className="cy-moon" aria-hidden="true" />
      <div ref={glowRef} className="cy-glow" aria-hidden="true" style={{ transform: "translate3d(-999px,-999px,0)" }} />
      <div className="cy-side">
        <div className="cy-titlecol">
          <h1 className="cy-title">八千里路</h1>
          <button type="button" className="cy-seal" onClick={enter} aria-label="入卷：進入檔案站">
            <span>入卷</span>
          </button>
        </div>
        <div className="cy-subtitle">士兵、殺手和大夫</div>
      </div>
      <div className={"cy-hint" + (moved ? " cy-hint--off" : "")}>
        <span>{coarse ? "拂過屏幕，燭照山河 · 鈐印入卷" : "移燭照覽山河 · 鈐印入卷"}</span>
      </div>
    </div>
  );
}
