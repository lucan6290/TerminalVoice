# Changelog

本文件记录 TerminalVoice 每个版本的主要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.3] - 2026-09-08

### Added
- 帮助页新增官网入口按钮，并完善外部链接打开失败提示

### Changed
- 问题反馈弹窗由表单简化为两条路径：GitHub 提交 Issue、发送邮件反馈

## [0.1.2] - 2026-09-07

### Fixed
- 修复应用内版本号硬编码显示为 0.1.0 的问题，改为动态读取后端版本
- 开启更新产物生成，修复自动更新 latest.json 缺失导致检查更新无法检测到新版本

## [0.1.1] - 2026-09-07

### Added
- 面板右上角新增锚定悬浮球位置打开功能

### Fixed
- 修复开发服务器端口与 Hyper-V 保留端口段冲突导致的 EACCES 启动失败（端口从 1234 调整为 4321）
- 修复 CI Release 工作流中 releaseBodyPath 不被 tauri-action 支持导致 Release Body 为空的问题（改用 releaseBody + GITHUB_OUTPUT 传递 CHANGELOG）
- 修复配置加载完成后 serviceReady 状态未重新计算，首次启动时服务可用状态显示不正确的问题
- 移除 tray.rs 源文件头部误留的 BOM 字符

### Changed
- 浮球 idle 状态外圈改为透明，简化静止态视觉
- 调细全局滚动条样式并禁用横向滚动条

[Unreleased]: https://github.com/lucan6290/TerminalVoice/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/lucan6290/TerminalVoice/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/lucan6290/TerminalVoice/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lucan6290/TerminalVoice/compare/v0.1.0...v0.1.1

## [0.1.0] - 2026-09-06

### Added
- 三窗口架构（悬浮球 + 面板 + 主窗口）Tauri v2 桌面应用骨架
- Rust 状态机（Idle/Recording/Recognizing/Preview/Paused 五状态 + 9 事件 + 8 单元测试）
- 前端 Zustand store（loadAll 初始化 + 乐观更新 + 回滚）
- BallWindow：7 状态视觉（idle/recording/thinking/disabled/error/rewrite/tts）+ 毛玻璃效果
- PanelWindow：顶部栏 + 首页快捷设置 + 深浅主题 + 6 个 Tab（Skill/Dict/History/Help/Service/Settings）
- PreviewPopup：双模式预览弹窗（识别结果/AI 改写），Ctrl+Enter 确认 / Esc 取消
- 文本预处理（Normal/Developer/Raw 三模式 + 过滤词 + 标点）
- SQLite 数据库（config/history/filter_words 三表，WAL 模式）
- 语音技能预设系统（英文输出/清单模式/汇报格式/听写模板）
- LLM 流式输出（SSE streaming，实时推送增量文本）
- 自动更新功能（tauri-plugin-updater，签名校验 + 一键下载安装）
- 全 UI 中英双语（zh-CN / en），切换即时生效
- 识别后预览确认开关（`input.skipPreview`，关闭时识别完成直接上屏）
- 自定义热键配置（按住说话 / 朗读 / 翻译三键，运行时可重载）
- 完整系统托盘菜单（暂停 / 技能切换 / 主题 / 悬浮球显隐 / 日志 / 关于 / 检查更新）
- 悬浮球拖拽移动 + 默认定位屏幕右上区域
- 云端 ASR 接入（OpenAI Whisper 兼容）+ DPAPI 密钥加密存储
- ASR / LLM 服务配置界面 + 连接测试 + 模型列表获取
- 应用上下文识别（历史记录标注录入时前台应用）
- 设计系统：Tailwind v4 tokens（颜色/圆角/阴影/字体/动画）
- 全局 Toast / ErrorModal / TranslatePopup / UpdateModal 浮层组件
- 系统托盘 + 开机自启 + 单实例插件
- 结构化日志（tracing + tracing-subscriber，文件输出）
- 项目专属图标
- CI/CD：GitHub Actions PR 检查 + Release 自动构建签名发布

### Changed
- 统一数据目录到 `~/.terminalvoice/`

[0.1.0]: https://github.com/lucan6290/TerminalVoice/releases/tag/v0.1.0

> 规则：`## [Unreleased]` 永远保留在顶部作为占位；新版本条目插在它下方。某分类无内容则省略该分类标题。每条 `- ` 开头、面向用户的中文描述、结尾不加标点、不含内部实现细节。compare 链接为可选，指向相邻版本 diff。
