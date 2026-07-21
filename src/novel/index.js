/* ============================================================
   文庫 · 小說正文（結構）
   結構定義唯此一處：故事線 → 章節（或 卷 → 子章）。
   正文每章一個 .txt，經 texts.js 於進入閱讀器時懶加載（見 loadTexts）；
   本檔只存結構與各章 file 欄（相對 src/novel 的檔名），不靜態 import 正文，
   故正文不入首屏主包。未有正文者 file 為 undefined，閱讀器自顯「正文待錄」。
   新增正文：建 txt → 於對應章掛上 file 即可（texts.js 用 glob 自動收錄）。
   ============================================================ */

const NUM = ["一", "二", "三", "四", "五", "六", "七"];
/* 各線通例分章：定場、序、第一至第七章；files 以章 id 掛正文檔名 */
const stdChapters = (files = {}) => [
  { id: "dingchang", title: "定场", file: files.dingchang },
  { id: "xu", title: "序", file: files.xu },
  ...NUM.map((n, i) => ({ id: `c${i + 1}`, title: `第${n}章`, file: files[`c${i + 1}`] })),
];

export const NOVELS = [
  {
    id: "shengfeng", tag: "生逢", title: "大寺烈焰冲天",
    chapters: [
      ...stdChapters(),
      /* 【门墙】為卷，與諸章同級，其下再分章 */
      { id: "menqiang", title: "门墙", chapters: NUM.slice(0, 5).map((n, i) => ({ id: `m${i + 1}`, title: `第${n}章`, file: `shengfeng/m${i + 1}.txt` })) },
    ],
  },
  { id: "qingling", tag: "青岭", title: "她的遗迹", chapters: stdChapters() },
  { id: "denglou", tag: "登楼", title: "未到关前", chapters: stdChapters({ dingchang: "denglou/dingchang.txt" }) },
  { id: "zhongtao", tag: "种桃", title: "负我蛾眉", chapters: stdChapters() },
  { id: "langxin", tag: "郎心", title: "他年对坐炉边", chapters: stdChapters() },
  { id: "siting", tag: "思停", title: "那里没有麋鹿", chapters: stdChapters() },
];

/* 展平為閱讀順序，供上一章／下一章翻頁與路徑檢索；ch.file 攜正文檔名 */
export const FLAT = [];
for (const nv of NOVELS) {
  for (const ch of nv.chapters) {
    if (ch.chapters) {
      for (const sub of ch.chapters) FLAT.push({ path: `${nv.id}/${ch.id}/${sub.id}`, novel: nv, group: ch, ch: sub });
    } else {
      FLAT.push({ path: `${nv.id}/${ch.id}`, novel: nv, group: null, ch });
    }
  }
}

/* 正文懶加載：進入閱讀器時動態 import texts.js（Vite 切出的獨立塊），
   得 { file: 正文 } 映射。多次調用共用同一 Promise（模塊緩存），不重複下載。 */
export function loadTexts() {
  return import("./texts.js").then((m) => m.TEXTS);
}
