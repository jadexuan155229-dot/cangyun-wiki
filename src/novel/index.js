/* ============================================================
   文庫 · 小說正文
   結構定義唯此一處：故事線 → 章節（或 卷 → 子章）。
   正文每章一個 .txt，經 Vite `?raw` 於構建時導入；
   未有正文者不必建檔，閱讀器自顯「正文待錄」。
   新增正文：建 txt → 於對應故事線的 texts 掛上章 id 即可。
   ============================================================ */
import dlDingchang from "./denglou/dingchang.txt?raw";
import sfM1 from "./shengfeng/m1.txt?raw";
import sfM2 from "./shengfeng/m2.txt?raw";
import sfM3 from "./shengfeng/m3.txt?raw";
import sfM4 from "./shengfeng/m4.txt?raw";
import sfM5 from "./shengfeng/m5.txt?raw";


const NUM = ["一", "二", "三", "四", "五", "六", "七"];
/* 各線通例分章：定場、序、第一至第七章；texts 以章 id 掛正文 */
const stdChapters = (texts = {}) => [
  { id: "dingchang", title: "定场", text: texts.dingchang },
  { id: "xu", title: "序", text: texts.xu },
  ...NUM.map((n, i) => ({ id: `c${i + 1}`, title: `第${n}章`, text: texts[`c${i + 1}`] })),
];

export const NOVELS = [
  {
    id: "shengfeng", tag: "生逢", title: "大寺烈焰冲天",
    chapters: [
      ...stdChapters(),
      /* 【门墙】為卷，與諸章同級，其下再分章 */
      { id: "menqiang", title: "门墙", chapters: [sfM1, sfM2, sfM3, sfM4, sfM5].map((t, i) => ({ id: `m${i + 1}`, title: `第${NUM[i]}章`, text: t })) },
    ],
  },
  { id: "qingling", tag: "青岭", title: "她的遗迹", chapters: stdChapters() },
  { id: "denglou", tag: "登楼", title: "未到关前", chapters: stdChapters({ dingchang: dlDingchang }) },
  { id: "zhongtao", tag: "种桃", title: "负我蛾眉", chapters: stdChapters() },
  { id: "langxin", tag: "郎心", title: "他年对坐炉边", chapters: stdChapters() },
  { id: "siting", tag: "思停", title: "那里没有麋鹿", chapters: stdChapters() },
];

/* 展平為閱讀順序，供上一章／下一章翻頁與路徑檢索 */
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
