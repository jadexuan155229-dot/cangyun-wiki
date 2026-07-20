/* ============================================================
   一字品評 · SVG 印章 (seals.js)
   改用 SVG 印面的人物：人物 id → public/images/seals/ 下的檔名。
   未列入者仍走 cangyun-wiki.jsx 中 Seal 的文字印章分支。
   體例：檔名為 <id>-<品評字拼音>.svg；id 與檔名不一律同形
   （如 lifei / 荔非承烈），故此處顯式列舉，不由 id 拼路徑。
   增刪即改此表一行；檔案缺失、id 不存在、品評字為空、
   目錄中有無人引用的孤兒圖，均由 scripts/check-data.js 攔下。
   七圖同模板：紅面在 100×100 viewBox 中同位同尺寸
   （x 6.73..93.51、y 6.40..93.76），故共用一組縮放係數。
   ============================================================ */
export const SEAL_SVG_FILE = {
  lvdingyi: "lvdingyi-qiao.svg",
  lifei: "lifei-ba.svg",
  minfangcheng: "minfangcheng-zhuo.svg",
  diyuanke: "diyuanke-su.svg",
  jinchenbai: "jinchenbai-yi.svg",
  xuechu: "xuechu-ping.svg",
  qiuhong: "qiuhong-min.svg",
  biansaiyuan: "biansaiyuan-ji.svg",
  fanzhang: "fanzhang-zhi.svg",
  guanyue: "guanyue-jian.svg",
  lianshuo: "lianshuo-qi.svg",
  louqiao: "louqiao-xian.svg",
};
