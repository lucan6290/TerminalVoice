# Changelog

本文件记录 TerminalVoice 每个版本的主要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-09-06

### Added
- 三窗口架构（悬浮球 + 面板 + 主窗口）Tauri v2 桌面应用骨架
- Rust 状态机（Idle/Recording/Recognizing/Preview/Paused 五状态 + 8 事件）
- 前端 Zustand store（loadAll 初始化 + 乐观更新）
- BallWindow：7 状态视觉（idle/recording/thinking/disabled/error/rewrite/tts）+ 毛玻璃效果
- PanelWindow：顶部栏 + 首页快捷设置 + 深浅主题 + 5 个 Tab（Skill/Dict/History/Help/Service）
- PreviewPopup：双模式预览弹窗（识别结果/AI 改写），Ctrl+Enter 确认 / Esc 取消
- PreviewPopup 双模式预览：识别结果（绿色）/ AI 改写（紫色）
- 文本预处理（Normal/Developer/Raw 三模式 + 过滤词 + 标点）
- SQLite 数据库（config/history/filter_words 三表，WAL 模式）
- 语音技能预设系统（英文输出/清单模式/汇报格式/听写模板）
- LLM 流式输出（SSE streaming，实时推送增量文本）
- 自动更新功能（tauri-plugin-updater，签名校验 + 一键下载安装）
- 设计系统：Tailwind v4 tokens（颜色/圆角/阴影/字体/动画）
- 全局 Toast / ErrorModal / TranslatePopup 浮层组件
- 系统托盘 + 开机自启 + 单实例插件
- 结构化日志（tracing + tracing-subscriber，文件输出）
- CI/CD：GitHub Actions PR 检查 + Release 自动构建签名发布

[Unreleased]: https://github.com/OWNER/TerminalVoice/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/TerminalVoice/releases/tag/v0.1.0

> 规则：`## [Unreleased]` 永远保留在顶部作为占位；新版本条目插在它下方。某分类无内容则省略该分类标题。每条 `- ` 开头、面向用户的中文描述、结尾不加标点、不含内部实现细节。compare 链接为可选，指向相邻版本 diff。
