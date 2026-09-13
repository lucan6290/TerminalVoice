# AGENTS.md — site/ 产品官网维护指南

> 本文档面向后续维护 TerminalVoice 官网的 Agent，说明站点结构、品牌规范、可交互原型的架构，以及如何安全地修改内容。
> 阅读后应能独立完成「改文案 / 换配色 / 增删区块 / 调原型交互」等操作。

---

## 1. 站点定位

`site/` 是 TerminalVoice 的**手写静态官网**（5 个独立 HTML 页面），通过 GitHub Actions 部署到
`https://lucan6290.github.io/TerminalVoice/`。

- **零依赖**：每个页面内联全部 CSS/SVG/JS，仅用系统字体，不加载任何 CDN。
- **多页面**：`index.html`（首页）+ `docs.html`（文档）+ `guide.html`（攻略）+ `changelog.html`（日志）+ `download.html`（下载），通过顶部导航互相链接。
- **品牌一致**：配色严格对齐产品设计系统 [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md)。

## 2. 文件清单

| 文件 | 职责 | 是否常改 |
|---|---|---|
| `index.html` | 首页（导航 + hero 可交互原型 + 功能/工作流/界面/技术栈/CTA/贡献/页脚） | 常改 |
| `docs.html` | 文档中心（链接项目 `docs/` 各类文档到 GitHub） | 按需 |
| `guide.html` | 使用攻略（说/听/译动作 + 快捷键 + AI 整理模式） | 按需 |
| `changelog.html` | 更新日志（时间线展示版本变更） | 发版时改 |
| `download.html` | 下载页（Windows 下载 + 源码构建 + 环境要求） | 按需 |
| `screenshot.cjs` | Chrome headless 截图脚本（输出到 `../docs/picture/`） | 按需 |
| `README.md` | 站点说明（预览/部署/设计风格） | 按需 |
| `.nojekyll` | GitHub Pages 必需（空文件，**勿删**） | 不改 |

> **共享设计系统**：5 个页面共用同一套 CSS 变量（`:root` / `body.dark`）+ 导航 + 页脚结构。`index.html` 额外包含可交互原型的独立样式与脚本。修改品牌色时需在**所有页面**同步改 `--accent*` 变量。

## 3. 品牌设计 token（勿脱离此规范硬编码色值）

站点 `:root`（浅色）与 `body.dark`（深色）定义了两套语义化 CSS 变量：

| Token | 浅色 | 深色 | 说明 |
|---|---|---|---|
| `--accent` | `#34c759` | `#30d158` | 品牌绿（按钮/激活态/强调） |
| `--accent-text` | `#1f9d3f` | `#30d158` | 浅底上的绿色文字（保证对比度） |
| `--bg` | `#ffffff` | `#0a0a0a` | 页面背景 |
| `--surface` | `#ffffff` | `#1c1c1e` | 卡片背景 |
| `--ink` / `--ink-2` / `--ink-3` | 文字层级 | 文字层级 | 主/次/辅助文字 |
| `--border` / `--border-strong` | 边框 | 边框 | 分隔线/描边 |
| `--danger` / `--warning` / `--info` | `#ff3b30` / `#ff9500` / `#007aff` | 同 | 功能色 |

修改品牌色只需改这两处的变量，其余样式通过 `var(--*)` 引用会自动跟随。

## 4. 首页可交互原型（hero 区）

hero 右侧的悬浮球 + 面板是**高保真可交互原型**，用纯原生 JS 在一个 IIFE 内实现，与站点脚本完全隔离。

### 4.1 架构原则（遵循 workflow 规范）

1. **单一状态 + 全量渲染 + 事件委托**：集中状态对象 `S`，`render()` 全量重渲染面板 DOM；交互元素挂 `data-act`（点击）/`data-input`（输入）/`data-change`（下拉），在容器 `#app` 上统一委托。
2. **设计 token 化**：面板颜色全部抽成 `.app`（深色默认）与 `.app.light` 两套 `--p-*` 变量，切换主题只改 class。
3. **mock 数据对齐真实模型**：`DATA.filterWords` / `DATA.history` / `SKILLS` 结构对齐 [services/skills.rs](../src-tauri/src/services/skills.rs) 与 [lib/types.ts](../src/lib/types.ts) 的字段（camelCase）。
4. **每个操作有反馈**：保存/复制/上屏 → 绿色 Toast；删除/失败 → 红色；普通提示 → 蓝色；切换 → 即时状态变化。
5. **双语**：`L` 字典（zh-CN / en）+ `t(key, params)` 取值，语言切换全量重渲染。
6. **状态隔离**：原型变量全在 IIFE 闭包内，不污染 `window` 与站点脚本。

### 4.2 关键结构

| 模块 | 位置 | 说明 |
|---|---|---|
| 状态 `S` | `const S = {...}` | 面板主题/当前 Tab/开关/技能/词典/历史/预览等 |
| 数据 `DATA` | `const DATA = {...}` | 过滤词 + 历史记录 mock |
| 技能 `SKILLS` | `const SKILLS = [...]` | 4 个语音技能（对齐 skills.rs） |
| 双语 `L` | `const L = {...}` | 中英文案字典 |
| 图标 `ICONS` + `svg()` | `const ICONS` / `function svg()` | 内联 SVG 图标（lucide 风格） |
| 渲染 `render()` | `function render()` | 全量重渲染面板 |
| 悬浮球 `renderBall()` | `function renderBall()` | 7 态悬浮球 |
| Toast `toast()` | `function toast()` | 操作反馈 |

### 4.3 悬浮球 7 态（`BALL_STATES`）

`idle`(绿点) / `recording`(天蓝麦克风) / `thinking`(琥珀加载) / `rewrite`(紫魔杖) / `tts`(青音量) / `disabled`(灰点) / `error`(红感叹号)，颜色对齐 [BallWindow.tsx](../src/windows/ball/BallWindow.tsx) 的 `STATE_META`。

## 5. 站点级脚本

第二个 IIFE 处理：全站深色/浅色切换（`#siteThemeBtn`，localStorage 持久化）、锚点平滑滚动、截图模式（`?shot=hero|ball|preview|main|tech|cta|full`）。

## 6. 常用修改

- **改品牌文案**：直接改 HTML 里的中文（hero 标题、功能卡片、CTA 等）。
- **改配色**：改 `:root` / `body.dark` 的 `--accent*` 变量。
- **改原型文案**：改 `L` 字典 + `SKILLS` + `DATA`。
- **加面板 Tab**：在 `renderBody()` 加分支 + `renderFoot()` 的 `tabs` 数组加项 + `S.tab` 处理。
- **加截图区块**：改 `screenshot.cjs` 底部清单，并在 index.html 的 shot 模式 `ids` 里登记对应锚点。

## 7. 验证清单（改完必查）

- `cd site && python -m http.server 7891`，浏览器打开 `http://localhost:7891/`
- hero 悬浮球可点击循环 7 态、面板 6 Tab 可切换、词典 CRUD 有 Toast、主题/双语切换生效
- 浏览器 console 无报错
- 缩窄窗口到手机宽度（≤680px）无横向滚动
- 全站深色模式切换正常
