# 更新记录

## 2026-07-19

**当日里程碑：站点正式上线。** 部署至 GitHub Pages —— **<https://jadexuan155229-dot.github.io/cangyun-wiki/>** ，公网公开可访问、链接可直接分享（源码仓 `jadexuan155229-dot/cangyun-wiki` 一并公开），此后 `push main` 即自动重新部署。此前项目只在本机与 zip 之间流转，至此有了对外地址。

本日各批改动均已真机／桌面验过，`npm run lint` 与 `npm run build` 皆过，分记如下。

### 三图触屏适配（`01132bc`）

行星图、群像图、舆地图此前只认鼠标，手机上不可用。三图各自一套缩放平移代码，此次抽出共用的 `usePanZoom(w, h)` 与 `ZoomBtns` 一并接入。

- **双指捏合**：多指以 `Map<pointerId>` 记账、`setPointerCapture` 接管，缩放以两指中点为锚。此前第二根手指落下会无条件覆写拖曳原点，双指操作时图幅跳变。
- **1× 时不夺页面滚动**：`touchAction` 仍是 `k>1` 才置 `none`。单指可照常划过图幅翻页，放大后才吃手势。代价是捏合放大须先按 ＋，换来的是整幅图不至于成为手机上的滚动死区。
- **悬停专属信息改点选可及**：触屏无悬停，此前有几处信息在手机上根本够不着。按 `useCoarsePointer()` 分流，桌面行为一概不变——
  - 群像图、行星图：轻触人物先显其关系边（弧），再触方开档案
  - 舆地图动线段：轻触浮出「繫此段之事」，且不转开档案（档案由驻点与人名承接）；浮框改浮于指上方，免为指腹所掩
  - 各图另加透明衬底，点空处即卸下所选
- **触屏点选域加大**：群像节点、行星节点、地点环、动线感应带在窄屏上实际只有几像素宽。
- **行星图补上缩放平移**：此前完全没有，1200×830 的幅面直接挤进手机宽度。

顺带修掉两个**既有缺陷，桌面同样中招**：

1. `movedRef`（防拖后误触的位移量）只在 `pointerdown` 里重置，而该回调在 `k===1` 时提前 return。于是「放大 → 拖动 → 按『回』复位」之后它永停在 >5，此后**一切点选**被当作拖后误触吞掉，只能刷新页面。
2. `setView` 的 updater 延后解引用 `dragRef.current`。React 19 中 `pointermove` 属连续事件被排队延后，`pointerup` 属离散事件抢先同步跑完并把 `dragRef` 置空，updater 这才执行、读 `null.tx` 抛错，整棵 React 树卸载。桌面鼠标 move 与 up 间隔大几乎撞不上，**安卓上一抬手就白屏**。改为先取快照、updater 只用局部值。

另在 `src/main.jsx` 加了开发期错误浮层（`import.meta.env.DEV` 守着，不入打包）：未捕获错误直接印在页面底部，手机上无控制台时靠它取堆栈。

### 印章与门派纹（`e1dd763`）

- 吕定仪的品评印章试点改用 SVG。`Seal` 抽出共用盒模型，SVG 与文字两式共享外框尺寸、内边距与基线；SVG 式以一枚隐藏字撑出等宽等高的占位盒，图片绝对定位铺满、不参与排版。
- 门派底纹增岑荃、唐军两种。
- `public/images/` 重整为 `faction-marks/` 与 `seals/` 两个子目录，`index.css` 路径随之更新。

### 岑荃底纹换图并瘦身

- 换用新的团花图样，并预先灰度化后转 WebP：**1.71 MB → 110 KB，小十六倍**。此纹的 CSS 本就带 `filter: grayscale(1)`，彩色信息一个像素都用不上，故预先灰度不改渲染结果（`filter` 保留不动，幂等）。原图与新图同为 1254×1254、四角纯黑，`mix-blend-mode: screen` 所需的黑底透出照旧。
- 删去从未被引用的 `cenquan-mark.webp`（64 KB）。`public/` 会被整个原样复制进 `dist`，未引用的资源照样发到线上，故须显式删除。
- 产物总体积由约 3.6 MB 降至 **1.8 MB**。

### 提交署名

此前全部提交用的是占位邮箱 `jade@example.com`（`example.com` 是保留域名，并非真实地址），GitHub 无从据此认人。已改为 noreply 匿名署名，并把既有 14 个提交的 author 与 committer 一并重写。因尚未推送至任何远程，此举无副作用；内容与重写前逐文件比对为零差异，只动元数据。

### 门派纹三图再瘦身（`8c69152`）

上线前把现存最大的三张 PNG 一并转 WebP：

- **衍天宗 393 → 56 KB、万灵 150 → 33 KB**：二者在 CSS 里作 `mask`，只吃 alpha 通道（注释所谓「mask 會壓成剪影」），故丢弃 RGB、仅存原 alpha 转 lossless WebP。alpha 逐像素与原 PNG 比对为零差异，剪影不变。
- **段氏 29 → 6 KB**：作 `background` 且本就带 `filter: grayscale(1)`，同岑荃底纹之法，预先灰度后转 WebP，不改渲染。
- 删去初始模板带入、全站零引用的社交图标 sprite `icons.svg`（bluesky/discord/github/x…）。`public/` 整个原样进 `dist`，未引用者照样发到线上。
- `dist` 由约 1.8 MB 降至 **1.4 MB**。

### 上线 GitHub Pages（`ea4ec2f`）

站点部署至项目子路径站 **<https://jadexuan155229-dot.github.io/cangyun-wiki/>**，push `main` 即经 Actions 自动 build 并发布，往后改动自动上线。

- `vite.config.js` 设 `base: '/cangyun-wiki/'`：站点不在根域，资产须带此前缀，否则从根请求全部 404。index.html、CSS `url()`、Vite 处理的资产均由构建自动重写。
- 唯一漏网是 `cangyun-wiki.jsx` 里印章 `img` 的硬编码 `src="/images/seals/…"`——JS 字符串字面量 Vite 不重写，改走 `import.meta.env.BASE_URL` 拼接。哈希路由不受子路径影响，无需 SPA rewrite。
- 新增 `.github/workflows/deploy.yml`：`npm ci` + build 后经 `actions/upload-pages-artifact` 与 `deploy-pages` 发布 `dist`；`dist` 仍 gitignore，由 CI 现构建、不入库。首轮因新仓 Pages 未启用而失败，启用（源＝GitHub Actions）后重跑 build ✓ deploy ✓，线上入口／JS／CSS／三图 webp／印章 svg／favicon 抽验皆 200、类型正确。

### og:image 分享卡

补上分享到聊天／社交时的预览卡图（`index.html` 之 `og:image`、`twitter:card`）。取站点人物档案首页截图（2511×1143），等比缩至 1200 宽后置于 1200×630 深色画布、上下衬边 42px——衬色取截图自身背景 `#15181D`（恰为 `theme-color`），标题、整条导航、门派筛选条与人物卡尽收、无一裁切。产物 `public/og.png` 149 KB。`og:image` 用线上绝对 URL，另补 `og:url`、`twitter:card=summary_large_image` 与宽高。

---

## 2026-07-18

项目由手工 zip 备份转入 git 版本控制，当日建立主要基础设施。

- **入库与校验**：站点全量入库；`scripts/check-data.js` 校验五库与词条的引用完整性，挂入 `npm run lint`。
- **哈希路由**（`src/router.js`）：页签、人物档案、文库章节写入网址，可分享、刷新不丢、前进后退可用。
- **元信息**：`index.html` 补 `lang=zh`、站名标题、description 与 OG 标签。
- **文库批注全量接入**：词条自 `CHARACTERS` 自动派生（`src/novel/char-terms.js`），118 人正文即点即出旁注卡，无须逐人加词条；识别逻辑抽为纯函数，可直接用 Node 测试。
- **文库反向索引**：档案弹窗增「見於文庫」，按「线（·卷）」两级聚合，点开见章、可直达。
- **阅读体验**：阅读位置记滚动偏移，回到文库接着上次读到处；阅读设置加字号五挡、行距三挡、玄墨／素纸两主题。
- **交互一致性**：`DetailPanel` 响应 Esc 关闭，与文库批注卡对齐。

---

## 待办

- **C2 正文按章懒加载**：等正文体量上来再做，连带把档案弹窗「見於文庫」的同步扫描改为异步（代码注释有提示）。
- **`readerNote` 按人补写**：无此字段者回退为摘要，现状可用，不必赶工。

条件触发项：正文若多以表字、别号指人，则加 `aliases` 识别；同名人物入库时 `check-data` 会拦下，届时另定人工映射；人名恰为常语而被误中者，以 `char-terms.js` 的 `TERM_EXCLUDE` 摘除。
