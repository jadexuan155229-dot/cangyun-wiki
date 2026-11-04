# 八千里路项目重命名与迁移

初次审查阶段只修改工作分支中的文件，未提交、推送或部署。用户已完成 GitHub 仓库改名，并授权更新 origin、提交到 main 和推送；本地根目录继续保持原名。下文保留可复用的迁移步骤。

## 统一名称

- 中文主标题：八千里路
- 英文名称：Eight Thousand Miles Away
- 技术名称与目标仓库名：`eight-thousand-miles-away-wiki`
- 副标题／资料库名：人山人海 · 档案
- 目标仓库：https://github.com/jadexuan155229-dot/eight-thousand-miles-away-wiki
- 目标 Pages：https://jadexuan155229-dot.github.io/eight-thousand-miles-away-wiki/

首页既有“八千里路”设计、款识、入卷交互及站内“人山人海 · 檔案”标题保留。OG 分享图仍为现有档案首页截图，未重绘。

## 文件修改清单

| 文件 | 修改 |
| --- | --- |
| `package.json`、`package-lock.json` | 同步根项目名称；依赖规格、解析版本与完整性记录不变 |
| `README.md` | 新品牌、全站介绍、目标地址、模块入口、验证指令和迁移链接 |
| `index.html` | 浏览器标题、description、Open Graph 与 Twitter Card 品牌及目标地址 |
| `vite.config.js` | 新 Pages base；构建期文库人物提及统计改从新数据模块读取 |
| `.github/workflows/deploy.yml` | 更新路径说明；现有工作流使用仓库上下文，无硬编码仓库名，部署逻辑保留 |
| `.vscode/tasks.json` | 开发服务任务显示新名称 |
| `.gitignore` | 添加新名称 ZIP 备份规则，保留旧备份规则 |
| `src/cangyun-wiki.jsx` → `src/wiki.jsx` | 全站界面模块改名，组件名改为 `Wiki`，更新文件头与数据导入 |
| `src/cangyun-data.js` → `src/wiki-data.js` | 全站数据模块改名，仅更新文件头说明；所有数据与辅助函数保持原样 |
| `src/App.jsx` | 导入并使用 `Wiki` |
| `src/landing.jsx`、`src/novel-reader.jsx`、`src/novel/char-terms.js` | 更新数据模块导入 |
| `scripts/check-data.js` | 更新数据模块导入及注释 |
| `src/i18n/characters.en.js`、`src/seals.js`、`src/theme.js`、`src/index.css` | 只更新模块名称注释 |
| `docs/wenku-margin-note.md` | 更新数据模块路径 |
| `docs/translation/terminology-inventory.md` | 更新模块路径和链接；保留原有术语记录。该文件在本轮开始时已未跟踪，保留本地，不纳入本次提交 |
| `docs/changelog.md` | 添加本次记录；保留历史原文并标注旧名称用途 |
| `docs/project-renaming.md` | 本说明 |

## 有意保留的旧名称

- 作品内的“苍云”“蒼雲”“苍云线”“蒼雲線”、英文 Cangyun、门派分类和原始数据。
- `public/images/faction-marks/cangyun-mark.webp` 与 `.faction-watermark--cangyun`：门派资源及选择器。
- `cangyun-wenku-pos`、`cangyun-wenku-scroll`、`cangyun-wenku-view`：现有阅读进度及偏好存储协议，保留以兼容既有数据。`cy-landing-seen`、`cy-language` 等键也保持原样。
- `.gitignore` 中的旧名称 ZIP 规则：继续忽略历史备份。
- 历史 changelog 中的旧模块名、旧品牌及旧网址：记录当时状态，不作为当前配置。
- 当前本地目录名：按用户要求暂不迁移。origin 已更新为新仓库地址。

## GitHub 手动操作与 remote

审查本次修改后，在仓库 **Settings → General → Repository name** 中将名称改为 `eight-thousand-miles-away-wiki`。然后在本地仓库执行：

```bash
git remote set-url origin https://github.com/jadexuan155229-dot/eight-thousand-miles-away-wiki.git
git remote -v
```

在 **Settings → Pages → Build and deployment → Source** 检查使用 **GitHub Actions**。现有工作流已支持新名称，无需另建部署分支。

确认本次代码审查结束后，再自行 commit、push 或另行授权后续操作。现有工作流在 push 到 `main` 时自动部署，也支持手动触发；仓库改名后不要先重跑仍含旧 base 的旧提交。

新地址需在改名并部署本次修改后验证。更新仓库 About 的网站地址以及站外书签、分享链接中的项目路径；`#/chars/...`、`#/novel/...` 等 hash 部分保持不变。GitHub 仓库重定向不包含项目 Pages 网址，旧站地址不应视作永久重定向。

依据：[GitHub 仓库改名说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)、[Pages 发布来源设置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。本轮未读取或修改线上 Settings，实际状态需用户检查。

## 本地文件夹安全改名（可选）

本地目录名不影响构建，可暂时保留。需要统一时：

1. 停止开发／预览服务器，保存编辑器文件，关闭指向旧目录的编辑器窗口。
2. 可先在仓库运行 `git status --short` 留存工作区状态。目录改名会整体保留 `.git`、未提交文件和未跟踪文件，无需清理或重置。
3. 在父目录执行以下命令。目标存在时停止，不合并、不覆盖：

```bash
cd /Users/jadexuan/projects
if [ -e eight-thousand-miles-away-wiki ] || [ -L eight-thousand-miles-away-wiki ]; then
  echo '目标路径已存在，请先检查；未执行改名。'
else
  mv -n cangyun-wiki eight-thousand-miles-away-wiki
fi
```

4. 确认改名成功后进入新目录，核对状态和 remote：

```bash
cd /Users/jadexuan/projects/eight-thousand-miles-away-wiki
git status --short
git remote -v
npm run dev
```

5. 在 VS Code 重新打开新目录；更新外部 workspace、终端书签或脚本中自行配置的绝对路径。仓库内未发现需修改的旧绝对根路径。

## 验证记录

- `npm run check-data`：通过，人物 121、事件 397、关系 224、地点 61、补点 46、词条 121。
- `npm run lint`：通过，有 12 条既有警告；与 HEAD 对比，归一化改名路径和字节偏移后，警告内容、行列位置一致。
- `npm run build`：通过，有大于 500 kB 的 chunk 提示。
- `git diff --check`：通过。
- 逐文件对照 HEAD：源码、CSS 与小说文件的差异严格限于模块引用／名称注释／文件头品牌；路由、人物与章节 ID、数据内容、首页绘制及交互逻辑保持原样。
- 逐项对照 package 与 lock：只改根名称，所有依赖记录不变。
- 所有 public 资源逐字节对照 HEAD：保持原样。
- 当前配置及生成的 HTML／JS／CSS：无旧部署路径；剩余旧项目名已在上文逐类说明。
- 路由转换检查：六个页签、人物深链、文库两层／三层路径往返一致。
- 本地生产预览 HTTP 检查：新 base 下 HTML、主 JS、CSS、favicon、OG 图片、苍云门派图片均返回 200。
- 浏览器访问工具当前不可用，未进行逐页点击和视觉回归；功能保持的依据为构建／数据校验、路由转换检查和源码差异白名单核对。线上部署验证留待用户改名及授权发布后进行。
