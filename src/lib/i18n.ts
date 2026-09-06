// TerminalVoice i18n — 中文(zh-CN) / 英文(en) 双语
// 通过 useT() hook 获取翻译函数；直接 import { t } 也可使用当前语言。

import { useSyncExternalStore } from "react";

export type Lang = "zh-CN" | "en";

// ---------- Translation dictionaries ----------

const zh: Record<string, string> = {
  // ---- Ball ----
  "ball.tooltip.clickToToggle": "点击切换面板",
  "ball.state.idle": "就绪 · 按住 Right-Alt 说话",
  "ball.state.recording": "录音中 · 松开上屏",
  "ball.state.thinking": "识别中…",
  "ball.state.disabled": "已暂停",
  "ball.state.error": "出错了 · 点击查看",
  "ball.state.rewrite": "改写模式 · 选中文字后说话",
  "ball.state.tts": "朗读中 · Alt+1 停止",

  // ---- Panel header ----
  "panel.header.serviceRunning": "服务运行中",
  "panel.header.updateAvailable": "新版本 v{version} 可用",
  "panel.header.btn.record": "录音",
  "panel.header.btn.record.holdTip": "按住 {key} 录音",
  "panel.header.btn.record.tooltip": "通过触发键录音",
  "panel.header.btn.recording": "录音进行中，请松开触发键结束",
  "panel.header.btn.recordInactive": "请使用 {key} 触发录音",
  "panel.header.btn.minimize": "最小化到托盘",
  "panel.header.btn.close": "关闭面板",
  "panel.header.serviceConfig": "服务配置",
  "panel.header.statusLabel": "当前状态",

  // ---- Panel home ----
  "panel.home.hotkeySectionTitle": "快捷键 · 点击按键可重新录制",
  "panel.home.hotkey.ptt": "按住说话",
  "panel.home.hotkey.tts": "朗读",
  "panel.home.hotkey.translate": "翻译",
  "panel.home.mic.label": "选择麦克风",
  "panel.home.mic.helpTip": "选择录音输入设备",
  "panel.home.toggle.sound": "交互声音",
  "panel.home.toggle.muteSys": "使用时静音系统声音",
  "panel.home.toggle.autoStart": "开机启动并隐藏面板",
  "panel.home.footerHint": "按住 {key} 说话 · 松开上屏",
  "panel.home.rewriteToggle": "改写模式",
  "panel.home.rewriteTip": "选中文本后按住热键说话，可改写选中内容",
  "panel.home.preview.title": "识别后预览确认",
  "panel.home.preview.desc": "关闭则识别完成后直接上屏",
  "panel.home.serviceStatus": "服务状态",

  // ---- Panel footer ----
  "panel.footer.uiLang.title": "界面语言：中文（点击切换）",
  "panel.footer.dark.light": "切换为浅色主题",
  "panel.footer.dark.dark": "切换为深色主题",
  "panel.footer.tab.skill": "语音技能",
  "panel.footer.tab.dict": "自定义词典",
  "panel.footer.tab.history": "历史记录",
  "panel.footer.tab.help": "帮助与关于",
  "panel.footer.tab.service": "服务配置",
  "panel.footer.tab.settings": "设置",
  "panel.footer.more": "更多选项",
  "panel.footer.menu.backup": "备份数据",
  "panel.footer.menu.restore": "恢复数据",
  "panel.footer.menu.checkUpdate": "检查更新",
  "panel.footer.menu.quit": "退出应用",
  "panel.footer.langLabel.cn": "中文",
  "panel.footer.langLabel.en": "English",

  // ---- Tabs: Settings ----
  "tab.settings.title": "设置",
  "tab.settings.section.preferences": "偏好设置",
  "tab.settings.section.data": "数据管理",
  "tab.settings.section.about": "关于与更新",
  "tab.settings.desc.backup": "导出配置与历史记录为备份文件",
  "tab.settings.desc.restore": "从备份文件恢复数据（覆盖当前）",
  "tab.settings.desc.checkUpdate": "检查是否有新版本可用",
  "tab.settings.desc.quit": "退出 TerminalVoice",
  "tab.settings.updateAvailable": "新版本 v{version} 可用，点击查看",

  // ---- Preview ----
  "preview.title.rewrite": "确认改写结果",
  "preview.title.recognition": "确认语音输入",
  "preview.subtitle.rewrite": "确认后将替换选中文本",
  "preview.subtitle.recognition": "可编辑整理结果，确认后写入当前输入框",
  "preview.closeBtn": "放弃",
  "preview.sourceLabel.rewrite": "改写原文",
  "preview.sourceLabel.recognition": "识别原文",
  "preview.resultLabel.rewrite": "改写结果（可编辑）",
  "preview.resultLabel.recognition": "整理结果（可编辑）",
  "preview.hint": "Ctrl+Enter 确认 · Esc 放弃",
  "preview.confirmBtn": "确认上屏",
  "preview.canceling": "放弃中…",
  "preview.submitting": "上屏中…",
  "preview.aria.rewrite": "改写结果预览",
  "preview.aria.recognition": "语音输入预览",
  "preview.aria.close": "放弃预览",
  "preview.aria.textarea": "预览文本",
  "preview.empty.rewrite": "改写结果不能为空",
  "preview.empty.recognition": "整理结果不能为空",

  // ---- State ----
  "state.recording": "录音中",
  "state.recognizing": "识别中...",
  "state.tts": "朗读中...",
  "state.tts.stop": "停止朗读",
  "state.llmStreaming": "AI整理中...",
  "state.translate": "翻译结果",
  "state.idle": "就绪",
  "state.preview": "预览等待确认",

  // ---- Toasts ----
  "toast.confirmed": "已确认并上屏",
  "toast.micEnumFail": "无法读取麦克风设备",
  "toast.exporting": "正在导出数据...",
  "toast.exportSuccess": "数据导出成功",
  "toast.exportFail": "导出失败",
  "toast.importSuccess": "数据导入成功，正在刷新...",
  "toast.importFail": "导入失败",
  "toast.checkingUpdate": "正在检查更新...",
  "toast.alreadyLatest": "当前已是最新版本",
  "toast.browserNoQuit": "浏览器模式不支持退出",
  "toast.quitFail": "退出失败",
  "toast.browserNoExport": "浏览器模式不支持数据导出",
  "toast.browserNoImport": "浏览器模式不支持数据导入",
  "toast.langSwitched": "界面语言已切换为{lang}",

  // ---- Tabs: Skill ----
  "tab.skill.title": "语音技能",
  "tab.skill.modeSectionTitle": "AI 文字整理模式",
  "tab.skill.mode.off": "原文直出",
  "tab.skill.mode.offDesc": "不进行AI整理，输出识别原文",
  "tab.skill.mode.proofread": "原意校对",
  "tab.skill.mode.proofreadDesc": "修正错别字和标点，保留原意",
  "tab.skill.mode.polish": "自然润色",
  "tab.skill.mode.polishDesc": "优化表达流畅度，口语转书面",
  "tab.skill.mode.structure": "结构整理",
  "tab.skill.mode.structureDesc": "自动分段、加标点、整理要点",
  "tab.skill.templateSectionTitle": "语音输入模板",
  "tab.skill.handsFree": "免提模式",
  "tab.skill.handsFreeDesc": "按一次开始录音，再按一次提交；松开不结束",
  "tab.skill.hint": "提示：AI 整理需要配置 LLM 服务，前往服务配置页面设置 API Key。",
  "tab.skill.active": "已启用",

  // ---- Tabs: Dict ----
  "tab.dict.title": "自定义词典",
  "tab.dict.activeCount": "{n} 条生效",
  "tab.dict.description": "添加常见口语词或错别字，语音识别后会自动替换为空或指定文字。",
  "tab.dict.input.word": "过滤词",
  "tab.dict.input.replacement": "替换为（空=删除）",
  "tab.dict.empty": "暂无过滤词",
  "tab.dict.emptyReplacement": "（空）",
  "tab.dict.added": "已添加「{word}」",
  "tab.dict.updated": "已更新",
  "tab.dict.deleted": "已删除",
  "tab.dict.addBtn": "添加",

  // ---- Tabs: History ----
  "tab.history.title": "历史记录",
  "tab.history.clearBtn": "清空",
  "tab.history.searchPlaceholder": "搜索历史记录...",
  "tab.history.empty": "暂无历史记录",
  "tab.history.noResults": "未找到匹配的记录",
  "tab.history.reinject": "重新上屏",
  "tab.history.delete": "删除",
  "tab.history.cleared": "历史记录已清空",
  "tab.history.reinjected": "已重新上屏",
  "tab.history.aiPolished": "AI整理",
  "tab.history.skillTag": "技能:{id}",
  "tab.history.developerMode": "开发者模式",
  "tab.history.rawText": "原文",

  // ---- Tabs: Help ----
  "tab.help.title": "帮助与关于",
  "tab.help.subtitle": "v0.1.0 · 语音输入 AI 助手",
  "tab.help.section.shortcuts": "快捷键",
  "tab.help.shortcut.ptt": "按住说话，松开上屏",
  "tab.help.shortcut.handsFree": "切换免提模式（按一次开始，再按一次结束）",
  "tab.help.shortcut.handsFreeKey": "单击",
  "tab.help.shortcut.tts": "朗读选中文本（再按一次停止）",
  "tab.help.shortcut.translate": "翻译选中文本",
  "tab.help.shortcut.esc": "关闭预览弹窗 / 停止录音",
  "tab.help.shortcut.ctrlEnter": "预览中确认",
  "tab.help.section.guide": "使用指南",
  "tab.help.guide.step1": "将光标定位到需要输入文字的地方（微信、浏览器、编辑器等）。",
  "tab.help.guide.step2": "按住 Right-Alt 对着麦克风说话，音量适中即可。",
  "tab.help.guide.step3": "松开按键，识别结果经 AI 整理后自动写入焦点输入框。",
  "tab.help.guide.step4": "选中文本后按住热键说出修改要求，可直接改写选中内容。",
  "tab.help.section.modes": "AI 整理模式",
  "tab.help.mode.off": "原文直出：不做任何 AI 处理，输出识别结果原样。",
  "tab.help.mode.proofread": "原意校对：只修正错别字、标点，保持原意和口语风格。",
  "tab.help.mode.polish": "自然润色：将口语转为流畅书面表达，推荐日常使用。",
  "tab.help.mode.structure": "结构整理：自动分段、加标点、提炼要点，适合长内容。",
  "tab.help.link.github": "项目主页",
  "tab.help.link.service": "服务配置",
  "tab.help.link.feedback": "反馈问题",
  "tab.help.thanksFeedback": "感谢反馈！",
  "tab.help.openingGithub": "即将打开 GitHub",

  // ---- App: Main window (legacy #/main) & DevPreview ----
  "app.main.title": "TerminalVoice 设置",
  "app.main.section.preferences": "通用设置",
  "app.main.autostart.label": "开机自启",
  "app.main.autostart.desc": "系统启动时自动运行",
  "app.main.dark.label": "深色模式",
  "app.main.dark.desc": "切换界面主题",
  "app.main.section.service": "服务状态",
  "app.main.service.translateTarget": "翻译目标语言",
  "app.main.llmUnconfigured": "未配置",
  "app.main.section.about": "关于",
  "app.main.about.version": "版本",
  "app.main.about.hotkeys": "快捷键",
  "app.dev.title": "TerminalVoice UI 预览",
  "app.dev.subtitle": "浏览器预览模式 · Tauri 中悬浮球与面板为独立透明窗口",
  "app.dev.card.ball": "悬浮小球",
  "app.dev.card.ball.sub": "点击切换 idle / 录音 / 识别 / 暂停",
  "app.dev.card.panel": "极简面板",
  "app.dev.card.panel.sub": "深/浅主题 · 可交互开关与按钮",
  "app.dev.footer1": "· 鼠标悬浮在小球/图标/按钮上可看到提示气泡",
  "app.dev.footer2": "· 面板左上角状态点与悬浮球均由后端 AppRuntime 同步驱动",
  "app.dev.footer3": "· 所有开关、按钮、主题切换均为可交互",

  // ---- Tabs: Service ----
  "tab.service.title": "服务配置",
  "tab.service.asr.section": "语音识别 (ASR)",
  "tab.service.asr.auto": "智能切换",
  "tab.service.asr.autoDesc": "优先云端，失败时自动降级离线",
  "tab.service.asr.cloud": "仅云端",
  "tab.service.asr.cloudDesc": "始终使用云端ASR，识别精度高",
  "tab.service.asr.offline": "仅离线",
  "tab.service.asr.offlineDesc": "使用本地模型，无需网络",
  "tab.service.llm.section": "AI 整理 (LLM)",
  "tab.service.field.endpoint": "API 地址",
  "tab.service.field.model": "模型",
  "tab.service.field.apiKey": "API Key",
  "tab.service.fullUrl": "完整 URL",
  "tab.service.testBtn": "测试连接",
  "tab.service.testBtn.asr": "测试 ASR 连接",
  "tab.service.testBtn.llm": "测试 LLM 连接",
  "tab.service.testing": "测试中…",
  "tab.service.testSuccess.asr": "ASR 连接成功",
  "tab.service.testSuccess.llm": "LLM 连接成功",
  "tab.service.testFail.asr": "ASR 连接失败，请检查配置",
  "tab.service.testFail.llm": "LLM 连接失败，请检查配置",
  "tab.service.testFail.generic": "连接测试失败",
  "tab.service.modelList.unavailable": "未获取到模型列表",
  "tab.service.modelList.count": "获取到 {n} 个模型",
  "tab.service.modelList.fail": "获取模型列表失败",
  "tab.service.modelList.fetchBtn": "获取模型列表",
  "tab.service.modelList.selectBtn": "选择模型",
  "tab.service.modelList.searchPlaceholder": "搜索模型...",
  "tab.service.modelList.noMatch": "无匹配模型",
  "tab.service.fullUrl.hint": "请填写完整请求 URL，将直接使用此 URL，不拼接路径",
  "tab.service.endpointHint.asr": "填写服务基础地址，自动拼接 /audio/transcriptions",
  "tab.service.endpointHint.llm": "填写服务基础地址，自动拼接 /chat/completions",
  "tab.service.translate.section": "翻译目标语言",
  "tab.service.translate.hint": "Alt+2 翻译时的目标语言",
  "tab.service.offline.section": "离线模型",
  "tab.service.offline.empty": "暂无可用模型",
  "tab.service.offline.installed": "已安装",
  "tab.service.offline.downloading": "下载中",
  "tab.service.offline.deleted": "已删除 {name}",
  "tab.service.offline.deleteBtn": "删除模型",
  "tab.service.offline.downloadStarted": "开始下载 {name}",
  "tab.service.offline.downloadBtn": "下载模型",
  "tab.service.translate.lang.zh": "中文",
  "tab.service.translate.lang.en": "英文",
  "tab.service.translate.lang.ja": "日文",
  "tab.service.translate.lang.ko": "韩文",
  "tab.service.translate.lang.fr": "法文",
  "tab.service.translate.lang.de": "德文",
  "tab.service.translate.lang.es": "西班牙文",
  "tab.service.translate.lang.ru": "俄文",

  // ---- Components ----
  "error.title": "出错了",
  "error.ok": "知道了",
  "error.close": "关闭",
  "translate.title": "翻译结果",
  "translate.close": "关闭翻译",
  "translate.original": "原文",
  "translate.translated": "译文",
  "hotkey.capturing": "按下按键...",
  "hotkey.saving": "保存中...",
  "hotkey.prompt": "按下要设置的键，按 Esc 取消",
  "hotkey.clickToEdit": "点击修改按键",
  "settingRow.helpAria": "{label}帮助",
  "common.cancel": "取消",
  "update.title": "v{version} 版本就绪",
  "update.later": "稍后重启",
  "update.restartNow": "立即重启",
  "update.downloading": "下载中",
  "update.downloadBtn": "下载更新",
  "update.currentVersion": "当前 v{version}",
  "update.downloadedHint": "下载完成，请重启以完成安装",
  "update.browserSimulated": "浏览器模式：重启已模拟",
  "update.restartFail": "重启失败，请手动重启应用",
};

const en: Record<string, string> = {
  // ---- Ball ----
  "ball.tooltip.clickToToggle": "Click to toggle panel",
  "ball.state.idle": "Ready · Hold Right-Alt to speak",
  "ball.state.recording": "Recording · Release to send",
  "ball.state.thinking": "Recognizing…",
  "ball.state.disabled": "Paused",
  "ball.state.error": "Error · Click to view",
  "ball.state.rewrite": "Rewrite mode · Select text then speak",
  "ball.state.tts": "Speaking · Alt+1 to stop",

  // ---- Panel header ----
  "panel.header.serviceRunning": "Service running",
  "panel.header.updateAvailable": "v{version} available",
  "panel.header.btn.record": "Record",
  "panel.header.btn.record.holdTip": "Hold {key} to record",
  "panel.header.btn.record.tooltip": "Record via hotkey",
  "panel.header.btn.recording": "Recording in progress, release the hotkey to finish",
  "panel.header.btn.recordInactive": "Use {key} to start recording",
  "panel.header.btn.minimize": "Minimize to tray",
  "panel.header.btn.close": "Close panel",
  "panel.header.serviceConfig": "Service",
  "panel.header.statusLabel": "Status",

  // ---- Panel home ----
  "panel.home.hotkeySectionTitle": "Hotkeys · click a key to rebind",
  "panel.home.hotkey.ptt": "Push to talk",
  "panel.home.hotkey.tts": "Read aloud",
  "panel.home.hotkey.translate": "Translate",
  "panel.home.mic.label": "Microphone",
  "panel.home.mic.helpTip": "Select recording input device",
  "panel.home.toggle.sound": "Sound effects",
  "panel.home.toggle.muteSys": "Mute system while recording",
  "panel.home.toggle.autoStart": "Launch at startup & hide panel",
  "panel.home.footerHint": "Hold {key} to speak · release to send",
  "panel.home.rewriteToggle": "Rewrite mode",
  "panel.home.rewriteTip": "Select text then hold hotkey to rewrite it",
  "panel.home.preview.title": "Preview before inserting",
  "panel.home.preview.desc": "Turn off to insert recognized text directly",
  "panel.home.serviceStatus": "Service status",

  // ---- Panel footer ----
  "panel.footer.uiLang.title": "UI Language: English (click to switch)",
  "panel.footer.dark.light": "Switch to light theme",
  "panel.footer.dark.dark": "Switch to dark theme",
  "panel.footer.tab.skill": "Voice skills",
  "panel.footer.tab.dict": "Dictionary",
  "panel.footer.tab.history": "History",
  "panel.footer.tab.help": "Help & About",
  "panel.footer.tab.service": "Services",
  "panel.footer.tab.settings": "Settings",
  "panel.footer.more": "More",
  "panel.footer.menu.backup": "Backup data",
  "panel.footer.menu.restore": "Restore data",
  "panel.footer.menu.checkUpdate": "Check for updates",
  "panel.footer.menu.quit": "Quit",
  "panel.footer.langLabel.cn": "中文",
  "panel.footer.langLabel.en": "English",

  // ---- Tabs: Settings ----
  "tab.settings.title": "Settings",
  "tab.settings.section.preferences": "Preferences",
  "tab.settings.section.data": "Data",
  "tab.settings.section.about": "About & Updates",
  "tab.settings.desc.backup": "Export config & history to a backup file",
  "tab.settings.desc.restore": "Restore data from a backup file (overwrites)",
  "tab.settings.desc.checkUpdate": "Check for new versions",
  "tab.settings.desc.quit": "Quit TerminalVoice",
  "tab.settings.updateAvailable": "v{version} available, click to view",

  // ---- Preview ----
  "preview.title.rewrite": "Confirm rewrite",
  "preview.title.recognition": "Confirm voice input",
  "preview.subtitle.rewrite": "Confirming will replace selected text",
  "preview.subtitle.recognition": "Edit the result, then confirm to insert",
  "preview.closeBtn": "Cancel",
  "preview.sourceLabel.rewrite": "Original text",
  "preview.sourceLabel.recognition": "Recognized text",
  "preview.resultLabel.rewrite": "Rewritten (editable)",
  "preview.resultLabel.recognition": "Result (editable)",
  "preview.hint": "Ctrl+Enter confirm · Esc cancel",
  "preview.confirmBtn": "Confirm & Insert",
  "preview.canceling": "Canceling…",
  "preview.submitting": "Inserting…",
  "preview.aria.rewrite": "Rewrite preview",
  "preview.aria.recognition": "Voice input preview",
  "preview.aria.close": "Dismiss preview",
  "preview.aria.textarea": "Preview text",
  "preview.empty.rewrite": "Rewrite result cannot be empty",
  "preview.empty.recognition": "Result cannot be empty",

  // ---- State ----
  "state.recording": "Recording",
  "state.recognizing": "Recognizing...",
  "state.tts": "Speaking...",
  "state.tts.stop": "Stop speaking",
  "state.llmStreaming": "AI processing...",
  "state.translate": "Translation",
  "state.idle": "Ready",
  "state.preview": "Preview pending",

  // ---- Toasts ----
  "toast.confirmed": "Confirmed & inserted",
  "toast.micEnumFail": "Failed to enumerate microphones",
  "toast.exporting": "Exporting data...",
  "toast.exportSuccess": "Export successful",
  "toast.exportFail": "Export failed",
  "toast.importSuccess": "Import successful, refreshing...",
  "toast.importFail": "Import failed",
  "toast.checkingUpdate": "Checking for updates...",
  "toast.alreadyLatest": "Already on latest version",
  "toast.browserNoQuit": "Quit not supported in browser mode",
  "toast.quitFail": "Failed to quit",
  "toast.browserNoExport": "Export not supported in browser mode",
  "toast.browserNoImport": "Import not supported in browser mode",
  "toast.langSwitched": "UI language switched to {lang}",

  // ---- Tabs: Skill ----
  "tab.skill.title": "Voice skills",
  "tab.skill.modeSectionTitle": "AI text processing",
  "tab.skill.mode.off": "Raw",
  "tab.skill.mode.offDesc": "No AI processing, output raw recognized text",
  "tab.skill.mode.proofread": "Proofread",
  "tab.skill.mode.proofreadDesc": "Fix typos and punctuation, preserve meaning",
  "tab.skill.mode.polish": "Polish",
  "tab.skill.mode.polishDesc": "Improve fluency, convert speech to writing",
  "tab.skill.mode.structure": "Structure",
  "tab.skill.mode.structureDesc": "Auto-segment, add punctuation, organize points",
  "tab.skill.templateSectionTitle": "Voice templates",
  "tab.skill.handsFree": "Hands-free",
  "tab.skill.handsFreeDesc": "Press once to start, press again to submit",
  "tab.skill.hint": "Note: AI processing requires a configured LLM service. Visit Services to set an API Key.",
  "tab.skill.active": "Active",

  // ---- Tabs: Dict ----
  "tab.dict.title": "Dictionary",
  "tab.dict.activeCount": "{n} active",
  "tab.dict.description": "Add common spoken words or typos to auto-replace after recognition.",
  "tab.dict.input.word": "Word",
  "tab.dict.input.replacement": "Replace with (empty = remove)",
  "tab.dict.empty": "No filter words yet",
  "tab.dict.emptyReplacement": "(empty)",
  "tab.dict.added": "Added \"{word}\"",
  "tab.dict.updated": "Updated",
  "tab.dict.deleted": "Deleted",
  "tab.dict.addBtn": "Add",

  // ---- Tabs: History ----
  "tab.history.title": "History",
  "tab.history.clearBtn": "Clear",
  "tab.history.searchPlaceholder": "Search history...",
  "tab.history.empty": "No history yet",
  "tab.history.noResults": "No matching records",
  "tab.history.reinject": "Re-insert",
  "tab.history.delete": "Delete",
  "tab.history.cleared": "History cleared",
  "tab.history.reinjected": "Re-inserted",
  "tab.history.aiPolished": "AI polished",
  "tab.history.skillTag": "Skill:{id}",
  "tab.history.developerMode": "Developer mode",
  "tab.history.rawText": "Raw",

  // ---- Tabs: Help ----
  "tab.help.title": "Help & About",
  "tab.help.subtitle": "v0.1.0 · Voice input AI assistant",
  "tab.help.section.shortcuts": "Shortcuts",
  "tab.help.shortcut.ptt": "Hold to talk, release to send",
  "tab.help.shortcut.handsFree": "Toggle hands-free (press to start/stop)",
  "tab.help.shortcut.handsFreeKey": "single press",
  "tab.help.shortcut.tts": "Read selected text (press again to stop)",
  "tab.help.shortcut.translate": "Translate selected text",
  "tab.help.shortcut.esc": "Close preview / stop recording",
  "tab.help.shortcut.ctrlEnter": "Confirm in preview",
  "tab.help.section.guide": "Guide",
  "tab.help.guide.step1": "Place your cursor where you want to type (WeChat, browser, editor, etc.).",
  "tab.help.guide.step2": "Hold Right-Alt and speak into the microphone at a normal volume.",
  "tab.help.guide.step3": "Release the key; the recognized (and AI-polished) text will be inserted into the focused field.",
  "tab.help.guide.step4": "Select text, then hold the hotkey and speak your revision to rewrite it in place.",
  "tab.help.section.modes": "AI processing modes",
  "tab.help.mode.off": "Raw: No AI processing; output the recognized text as-is.",
  "tab.help.mode.proofread": "Proofread: Fix typos and punctuation while preserving the original tone.",
  "tab.help.mode.polish": "Polish: Convert speech into fluent written text; recommended for daily use.",
  "tab.help.mode.structure": "Structure: Auto-segment, add punctuation, and extract key points; good for long content.",
  "tab.help.link.github": "GitHub",
  "tab.help.link.service": "Services",
  "tab.help.link.feedback": "Feedback",
  "tab.help.thanksFeedback": "Thanks for your feedback!",
  "tab.help.openingGithub": "Opening GitHub",

  // ---- App: Main window (legacy #/main) & DevPreview ----
  "app.main.title": "TerminalVoice Settings",
  "app.main.section.preferences": "Preferences",
  "app.main.autostart.label": "Launch at startup",
  "app.main.autostart.desc": "Automatically run when the system starts",
  "app.main.dark.label": "Dark mode",
  "app.main.dark.desc": "Switch interface theme",
  "app.main.section.service": "Service status",
  "app.main.service.translateTarget": "Translation target language",
  "app.main.llmUnconfigured": "Not configured",
  "app.main.section.about": "About",
  "app.main.about.version": "Version",
  "app.main.about.hotkeys": "Hotkeys",
  "app.dev.title": "TerminalVoice UI Preview",
  "app.dev.subtitle": "Browser preview · Ball & panel are separate transparent windows in Tauri",
  "app.dev.card.ball": "Floating ball",
  "app.dev.card.ball.sub": "Click to cycle idle / recording / recognizing / paused",
  "app.dev.card.panel": "Mini panel",
  "app.dev.card.panel.sub": "Dark/light theme · interactive toggles & buttons",
  "app.dev.footer1": "· Hover over the ball/icons/buttons to see tooltips",
  "app.dev.footer2": "· Status dot & floating ball are driven by backend AppRuntime sync",
  "app.dev.footer3": "· All toggles, buttons & theme switches are interactive",

  // ---- Tabs: Service ----
  "tab.service.title": "Services",
  "tab.service.asr.section": "Speech Recognition (ASR)",
  "tab.service.asr.auto": "Auto",
  "tab.service.asr.autoDesc": "Prefer cloud, fall back to offline",
  "tab.service.asr.cloud": "Cloud only",
  "tab.service.asr.cloudDesc": "Always use cloud ASR, higher accuracy",
  "tab.service.asr.offline": "Offline only",
  "tab.service.asr.offlineDesc": "Use local model, no network needed",
  "tab.service.llm.section": "AI Processing (LLM)",
  "tab.service.field.endpoint": "API URL",
  "tab.service.field.model": "Model",
  "tab.service.field.apiKey": "API Key",
  "tab.service.fullUrl": "Full URL",
  "tab.service.testBtn": "Test connection",
  "tab.service.testBtn.asr": "Test ASR",
  "tab.service.testBtn.llm": "Test LLM",
  "tab.service.testing": "Testing…",
  "tab.service.testSuccess.asr": "ASR connected",
  "tab.service.testSuccess.llm": "LLM connected",
  "tab.service.testFail.asr": "ASR connection failed, check config",
  "tab.service.testFail.llm": "LLM connection failed, check config",
  "tab.service.testFail.generic": "Connection test failed",
  "tab.service.modelList.unavailable": "Unable to fetch model list",
  "tab.service.modelList.count": "Fetched {n} models",
  "tab.service.modelList.fail": "Failed to fetch model list",
  "tab.service.modelList.fetchBtn": "Fetch models",
  "tab.service.modelList.selectBtn": "Select model",
  "tab.service.modelList.searchPlaceholder": "Search models...",
  "tab.service.modelList.noMatch": "No matching models",
  "tab.service.fullUrl.hint": "Enter the full request URL; it will be used as-is without path concatenation",
  "tab.service.endpointHint.asr": "Enter the base URL; /audio/transcriptions will be appended",
  "tab.service.endpointHint.llm": "Enter the base URL; /chat/completions will be appended",
  "tab.service.translate.section": "Translation target",
  "tab.service.translate.hint": "Target language for Alt+2 translation",
  "tab.service.offline.section": "Offline models",
  "tab.service.offline.empty": "No models available",
  "tab.service.offline.installed": "Installed",
  "tab.service.offline.downloading": "Downloading",
  "tab.service.offline.deleted": "Deleted {name}",
  "tab.service.offline.deleteBtn": "Delete model",
  "tab.service.offline.downloadStarted": "Started downloading {name}",
  "tab.service.offline.downloadBtn": "Download model",
  "tab.service.translate.lang.zh": "Chinese",
  "tab.service.translate.lang.en": "English",
  "tab.service.translate.lang.ja": "Japanese",
  "tab.service.translate.lang.ko": "Korean",
  "tab.service.translate.lang.fr": "French",
  "tab.service.translate.lang.de": "German",
  "tab.service.translate.lang.es": "Spanish",
  "tab.service.translate.lang.ru": "Russian",

  // ---- Components ----
  "error.title": "Error",
  "error.ok": "OK",
  "error.close": "Close",
  "translate.title": "Translation",
  "translate.close": "Close translation",
  "translate.original": "Original",
  "translate.translated": "Translation",
  "hotkey.capturing": "Press a key...",
  "hotkey.saving": "Saving...",
  "hotkey.prompt": "Press desired key, Esc to cancel",
  "hotkey.clickToEdit": "Click to rebind",
  "settingRow.helpAria": "{label} help",
  "common.cancel": "Cancel",
  "update.title": "v{version} is ready",
  "update.later": "Later",
  "update.restartNow": "Restart now",
  "update.downloading": "Downloading",
  "update.downloadBtn": "Download update",
  "update.currentVersion": "Current v{version}",
  "update.downloadedHint": "Download complete. Please restart to finish installing.",
  "update.browserSimulated": "Browser mode: restart simulated",
  "update.restartFail": "Restart failed; please restart the app manually",
};

// ---------- Current language state (observable) ----------

const LANG_STORAGE_KEY = "terminalvoice.uiLang";

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "zh-CN" || saved === "en") return saved;
  } catch {}
  // default: Chinese for Chinese locale, English otherwise
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

let currentLang: Lang = detectInitialLang();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
  // Also persist to backend if available
  try {
    if ("__TAURI_INTERNALS__" in window) {
      void import("./commands").then(({ setConfig }) => {
        void setConfig("ui.lang", lang).catch(() => {});
      });
    }
  } catch {}
  notify();
}

export function toggleLang(): Lang {
  const next: Lang = currentLang === "zh-CN" ? "en" : "zh-CN";
  setLang(next);
  return next;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sync with backend config after hydration (called once at startup). */
export function syncLangFromBackend(saved: string | null | undefined) {
  if (saved === "zh-CN" || saved === "en") {
    if (saved !== currentLang) {
      currentLang = saved;
      try { localStorage.setItem(LANG_STORAGE_KEY, saved); } catch {}
      notify();
    }
  }
}

// ---------- Translation function ----------

/**
 * Translate a key with optional interpolation params.
 * Usage: t("key", { name: "foo" }) replaces {name} in the string.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = currentLang === "en" ? en : zh;
  let str = dict[key] ?? zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

/** React hook that re-renders on language change. */
export function useT() {
  useSyncExternalStore(subscribe, () => currentLang, () => currentLang);
  return t;
}
