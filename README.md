# 八千里路 · Eight Thousand Miles Away

“人山人海 · 档案”：覆盖整个作品世界的人物档案、事件年表、山河舆图、关系网络和文库的综合资料站。项目从“苍云线”起步，现统一使用全作品品牌；作品内的阵营与故事线名称保持原样。

- 技术名称：`eight-thousand-miles-away-wiki`
- 目标仓库：<https://github.com/jadexuan155229-dot/eight-thousand-miles-away-wiki>
- 目标站点：<https://jadexuan155229-dot.github.io/eight-thousand-miles-away-wiki/>
- 全站界面：`src/wiki.jsx`；全站数据：`src/wiki-data.js`。

目标地址在 GitHub 仓库改名并发布本次修改后生效，迁移步骤见 [项目重命名说明](docs/project-renaming.md)。

## 检查与构建

```bash
npm ci
npm run check-data
npm run lint
npm run build
```

## 链接体例（哈希路由）

页签、打开的人物档案、文库章节都写入网址，可直接分享、刷新不丢、浏览器前进后退可用：

- `#/chars` `#/timeline` `#/map` `#/network` `#/community` `#/novel` —— 六个页签
- `#/chars/minfangcheng`、`#/timeline/lvdingyi` —— 第二段为打开的人物档案（文库页签除外）
- `#/novel/shengfeng/menqiang/m1` —— 文库章节：线 / 章（有卷则 线 / 卷 / 子章）
- `#/novel` 不带章节时自动回到上次阅读位置（章节及滚动处；分享出去的章节链接则总是从页首开始）

## 自动打开开发服务

使用 VS Code 打开这个项目文件夹时，项目会自动运行开发服务器，终端里会显示可点击的网页链接：

- `Local` 是本机访问地址。
- `Network` 是同一局域网内其他设备可用的地址。

首次打开项目时，如果 VS Code 询问是否允许自动任务，请选择“允许并运行”。

也可以随时手动启动：

```bash
npm run dev
```

停止服务时，在运行服务的终端中按 `Ctrl+C`。
