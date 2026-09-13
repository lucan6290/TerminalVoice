# site/ — TerminalVoice 产品宣传页（GitHub Pages 站点）

> 本目录是 TerminalVoice 的**对外产品宣传着陆页**，通过 GitHub Actions 自动部署到 `https://lucan6290.github.io/TerminalVoice/`。
> 同时它也是 README 截图的生成源——使用 Chrome headless 将每个区块渲染为 PNG 输出到 `docs/picture/`。

---

## 文件清单

```
site/
├── index.html        ← 首页（hero 可交互原型 + 功能/工作流/界面/技术栈/贡献）
├── docs.html         ← 文档中心（链接项目 docs/ 各类文档）
├── guide.html        ← 使用攻略（说/听/译三大动作 + 快捷键 + AI 整理模式）
├── changelog.html    ← 更新日志（时间线展示版本变更）
├── download.html     ← 下载页（Windows 下载 + 源码构建 + 环境要求）
├── AGENTS.md         ← 站点维护指南（改造规范、可交互原型架构说明）
├── screenshot.cjs    ← Chrome headless 自动截图脚本（输出到 ../docs/picture/）
├── .nojekyll         ← 告诉 GitHub Pages 不要用 Jekyll 处理（避免 _ 开头文件被忽略）
└── README.md         ← 你正在读
```

> 5 个页面共用同一套绿色设计系统，通过顶部导航（首页 / 文档 / 攻略 / 更新日志 / 免费下载）互相链接。

---

## 本地预览

```powershell
# 在 site/ 目录启动静态服务器
cd site
python -m http.server 7891

# 浏览器打开
# http://localhost:7891/
```

---

## 重新生成截图

```powershell
# 1. 确保静态服务器正在运行（端口 7891，见上）
# 2. 在项目根目录运行截图脚本
node site/screenshot.cjs
```

截图输出到 `docs/picture/`，README.md 直接引用这些图片。

---

## 线上部署

部署由 [.github/workflows/pages.yml](../.github/workflows/pages.yml) 自动完成：

- 触发时机：推送到 `main` 分支且 `site/**` 有变更，或手动触发（workflow_dispatch）
- 部署目标：GitHub Pages（Project Site）
- 访问地址：**https://lucan6290.github.io/TerminalVoice/**
- 与个人博客 `https://lucan6290.github.io/`（User Site）互不影响

**首次启用步骤**（只需在仓库 Settings 操作一次）：

1. 进入仓库 `Settings` → `Pages`
2. `Source` 选择 **GitHub Actions**（不是 Deploy from a branch）
3. 推送代码到 main，workflow 会自动构建并部署

---

## 设计风格

与产品设计系统（[docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md)）对齐的品牌色：

- 主色：品牌绿 `#34C759`（深色下 `#30D158`）
- 深色背景：`#1C1C1E`；浅色背景：`#FFFFFF`
- 功能色：红 `#FF3B30`、橙 `#FF9500`、蓝 `#007AFF`、紫 `#BF5AF2`
- 字体：系统字体栈（苹方/微软雅黑/Segoe UI）+ 等宽（Consolas/SF Mono）
- 图标：内联 SVG（lucide 风格），零 CDN 依赖
- 支持全站深色/浅色切换（导航栏月亮/太阳按钮，localStorage 持久化）

### 首页可交互原型

首页 hero 区的悬浮球 + 面板是**高保真可交互原型**（纯原生 JS，独立作用域），完整复现真实产品界面：

- 悬浮球：点击循环 7 种状态（空闲/录音/识别/改写/朗读/暂停/出错），带颜色、图标与光晕动画
- 面板：6 个 Tab（服务配置/语音技能/自定义词典/历史记录/帮助/设置）全部可切换
- 词典：增/删/改/开关过滤词（内存 CRUD）
- 历史：搜索过滤、重新上屏、删除、清空
- 技能：4 种 AI 整理模式 + 4 个语音技能选择
- 主题：面板内深色/浅色切换（独立于站点主题）
- 双语：面板内中英文切换
- 预览弹窗：识别/改写双模式，可编辑、确认/取消
- Toast：每个操作有可见反馈（成功绿/失败红/警告橙/信息蓝）

维护规范详见 [AGENTS.md](AGENTS.md)。
