# TerminalVoice Multi-Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable TerminalVoice MVP baseline: a Tauri v2 + React + Rust desktop app skeleton with shared contracts, text preprocessing, local SQLite persistence, state transitions, preview UI, and a mock recognition-to-preview-to-history flow that multiple agents can implement in parallel.

**Architecture:** Current repository contains product and architecture documents only, so the first deliverable must create a stable project skeleton and shared interfaces before parallel feature work starts. After Task 1, backend text processing, backend storage, backend state, and frontend UI can be implemented by separate agents because they communicate through explicit Rust/TypeScript contracts and IPC command names. Real microphone capture, real ASR vendors, Windows text injection, tray hardening, installer packaging, and full PRD acceptance are intentionally left for follow-up implementation plans because they are separate subsystems with OS-specific risk.

**Tech Stack (versions updated 2026-08):** Tauri v2 (≥ 2.5), Rust ≥ 1.85, React 19, TypeScript 5.7+, Vite 8 (Rolldown+Oxc) with `@vitejs/plugin-react` v6, Tailwind CSS v4 + `@tailwindcss/vite`, Zustand 5, shadcn/ui (CLI v4), SQLite via `rusqlite` 0.40 (bundled), Vitest 3, Testing Library 16, `serde`, `thiserror` 2, `chrono` 0.4, cpal 0.18, enigo 0.6, arboard 3, windows-sys 0.61, tauri plugins (global-shortcut / clipboard-manager / dialog / shell / autostart) 2.x. **Package manager: pnpm only (no npm).**

---

## Current Repository Facts

The repository currently has these project files:

- `TerminalVoice_PRD_V1.0.md` — product requirements document. The file content says PRD V1.1 and defines Windows global voice input, preview editing, text preprocessing, history, settings, tray, data storage, and acceptance criteria.
- `docs/ARCHITECTURE.md` — architecture design for Tauri v2, Rust backend services, React frontend, SQLite, DPAPI, hotkey, recorder, ASR, injector, and tray.
- `docs/IMPLEMENTATION.md` — staged implementation proposal covering skeleton, hotkey, recorder, ASR, preprocessing, preview, tray, persistence, packaging, and validation.

The directory is not currently a Git repository. The commit steps below are written as explicit commands for a future Git-enabled execution, but workers must only run them if the human explicitly authorizes commits and the repository has been initialized.

---

## Multi-Agent Collaboration Model

### Dependency Graph

```text
Task 1: Scaffold + contracts
   ├── Task 2A: Backend text preprocessing
   ├── Task 2B: Backend SQLite persistence
   ├── Task 2C: Backend app state machine
   └── Task 2D: Frontend shell + preview/history UI
             └── Task 3: IPC integration + mock end-to-end flow
                     └── Task 4: Validation checklist + handoff notes
```

### Parallel Assignment

- **Coordinator Agent:** Task 1, Task 3, Task 4. This agent owns shared file creation, command registration, integration, and final verification.
- **Backend Text Agent:** Task 2A only. This agent edits `src-tauri/src/services/preprocess.rs` and its tests.
- **Backend Storage Agent:** Task 2B only. This agent edits `src-tauri/src/services/db.rs` and its tests.
- **Backend State Agent:** Task 2C only. This agent edits `src-tauri/src/state.rs` and its tests.
- **Frontend Agent:** Task 2D only. This agent edits `src/` frontend files and frontend tests.

### Coordination Rules

1. Task 1 must complete before any parallel task starts.
2. Parallel agents must not edit files outside their task's file list.
3. Each agent must run only the tests listed in their task before returning.
4. The Coordinator Agent runs the full validation commands after all parallel tasks complete.
5. If two agents need to change the same public contract, stop and route the change through Task 1 contract files first.

---

## File Structure

Create this structure during Task 1:

```text
TerminalVoice/
├── package.json
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── test/setup.ts
│   ├── lib/
│   │   ├── commands.ts
│   │   └── types.ts
│   ├── components/
│   │   ├── PreviewPopup.tsx
│   │   └── StatusBadge.tsx
│   └── pages/
│       ├── History.tsx
│       └── Settings.tsx
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    └── src/
        ├── main.rs
        ├── lib.rs
        ├── state.rs
        ├── commands/
        │   ├── mod.rs
        │   ├── history.rs
        │   └── preview.rs
        └── services/
            ├── mod.rs
            ├── db.rs
            └── preprocess.rs
```

Responsibilities:

- `src-tauri/src/state.rs` owns app state transitions and has no UI or database code.
- `src-tauri/src/services/preprocess.rs` owns deterministic text processing and has no Tauri dependencies.
- `src-tauri/src/services/db.rs` owns SQLite schema, default seed data, history writes, and history reads.
- `src-tauri/src/commands/*.rs` owns Tauri IPC adapters only.
- `src/lib/types.ts` mirrors the Rust command payloads used by React.
- `src/lib/commands.ts` wraps Tauri `invoke` calls so UI components do not hard-code command names.
- `src/components/PreviewPopup.tsx` owns preview editing and confirmation.
- `src/pages/History.tsx` owns history list display.
- `src/pages/Settings.tsx` owns visible settings placeholders for the MVP baseline; persistent settings get a later plan.

---

## Task 1: Project Scaffold and Shared Contracts

**Owner:** Coordinator Agent  
**Parallelization:** Serial prerequisite for every other task.

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/commands.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/history.rs`
- Create: `src-tauri/src/commands/preview.rs`
- Create: `src-tauri/src/services/mod.rs`

- [ ] **Step 1: Create frontend package manifest**

Create `package.json`:

```json
{
  "name": "terminalvoice",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.11.0",
    "@tauri-apps/plugin-global-shortcut": "^2.3.0",
    "@tauri-apps/plugin-clipboard-manager": "^2.3.0",
    "@tauri-apps/plugin-dialog": "^2.3.0",
    "@tauri-apps/plugin-shell": "^2.3.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.553.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.3.0",
    "typescript": "~5.7.3",
    "vite": "^8.2.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create Vite and TypeScript configuration**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TerminalVoice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts` (Vite 8 + @tailwindcss/vite; TS paths built-in, no `vite-tsconfig-paths` needed):

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

Create `tsconfig.json` (TypeScript 5.7+; React 19 JSX runtime is the default when `jsx: "react-jsx"`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create shared TypeScript contracts**

Create `src/lib/types.ts`:

```ts
export type AppStatus = "Idle" | "Recording" | "Recognizing" | "Preview" | "Paused";

export type TextMode = "Normal" | "Developer" | "Raw";

export interface HistoryItem {
  id: number;
  created_at: string;
  source_text: string;
  final_text: string;
  text_mode: TextMode;
  asr_provider: string;
}

export interface PreviewDraft {
  sourceText: string;
  processedText: string;
  textMode: TextMode;
  asrProvider: string;
}

export interface ConfirmPreviewInput {
  sourceText: string;
  finalText: string;
  textMode: TextMode;
  asrProvider: string;
}
```

Create `src/lib/commands.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { AppStatus, ConfirmPreviewInput, HistoryItem, PreviewDraft } from "./types";

export async function getAppStatus(): Promise<AppStatus> {
  return invoke<AppStatus>("get_app_status");
}

export async function createMockPreview(rawText: string): Promise<PreviewDraft> {
  return invoke<PreviewDraft>("create_mock_preview", { rawText });
}

export async function confirmPreview(input: ConfirmPreviewInput): Promise<HistoryItem> {
  return invoke<HistoryItem>("confirm_preview", { input });
}

export async function listHistory(): Promise<HistoryItem[]> {
  return invoke<HistoryItem[]>("list_history");
}
```

- [ ] **Step 4: Create minimal React app entry**

Create `src/index.css` (Tailwind CSS v4 entry — no `tailwind.config.js` needed):

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.2 260);
  --radius-lg: 0.75rem;
}
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>TerminalVoice</h1>
      <p>项目骨架已启动。并行任务完成后，这里会显示预览、历史记录和设置入口。</p>
    </main>
  );
}
```

- [ ] **Step 5: Create Rust package manifest and Tauri configuration**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "terminalvoice"
version = "0.1.0"
description = "TerminalVoice desktop voice input tool"
authors = ["TerminalVoice Contributors"]
edition = "2021"
rust-version = "1.85"

[lib]
name = "terminalvoice_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-autostart = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.40", features = ["bundled"] }
cpal = "0.18"
hound = "3"
reqwest = { version = "0.12", default-features = false, features = ["multipart", "json", "rustls-tls"] }
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time", "fs"] }
enigo = "0.6"
arboard = "3"
windows-sys = { version = "0.61", features = [
    "Win32_System_DataProtection",
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_System_Registry",
    "Win32_Security_Cryptography",
    "Win32_UI_Shell",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Foundation",
] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-appender = "0.2"
log = "0.4"
```

> 注：MVP 骨架阶段可先只包含 `tauri / serde / serde_json / thiserror / chrono / rusqlite`，其余依赖（cpal/reqwest/enigo/arboard/windows-sys/tracing/plugins）在后续实现阶段按需添加。

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build();
}
```

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "TerminalVoice",
  "version": "0.1.0",
  "identifier": "com.terminalvoice.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "TerminalVoice",
        "width": 900,
        "height": 640,
        "visible": true,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for TerminalVoice MVP",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

- [ ] **Step 6: Create Rust module skeleton**

Create `src-tauri/src/main.rs`:

```rust
fn main() {
    terminalvoice_lib::run();
}
```

Create `src-tauri/src/lib.rs`:

```rust
pub mod commands;
pub mod services;
pub mod state;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::preview::get_app_status,
            commands::preview::create_mock_preview,
            commands::preview::confirm_preview,
            commands::history::list_history,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
```

Create `src-tauri/src/commands/mod.rs`:

```rust
pub mod history;
pub mod preview;
```

Create `src-tauri/src/commands/history.rs`:

```rust
use crate::services::db::HistoryItem;

#[tauri::command]
pub fn list_history() -> Result<Vec<HistoryItem>, String> {
    Ok(Vec::new())
}
```

Create `src-tauri/src/commands/preview.rs`:

```rust
use crate::services::db::HistoryItem;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AppStatus {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PreviewDraft {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "processedText")]
    pub processed_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfirmPreviewInput {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "finalText")]
    pub final_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[tauri::command]
pub fn get_app_status() -> Result<AppStatus, String> {
    Ok(AppStatus::Idle)
}

#[tauri::command]
pub fn create_mock_preview(raw_text: String) -> Result<PreviewDraft, String> {
    Ok(PreviewDraft {
        source_text: raw_text.clone(),
        processed_text: raw_text.trim().to_string(),
        text_mode: TextMode::Normal,
        asr_provider: "mock".to_string(),
    })
}

#[tauri::command]
pub fn confirm_preview(input: ConfirmPreviewInput) -> Result<HistoryItem, String> {
    Ok(HistoryItem::new_for_test(1, input.source_text, input.final_text))
}
```

Create `src-tauri/src/services/mod.rs`:

```rust
pub mod db;
pub mod preprocess;
```

- [ ] **Step 7: Create temporary backend service stubs for compilation**

Create `src-tauri/src/services/db.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryItem {
    pub id: i64,
    pub created_at: String,
    pub source_text: String,
    pub final_text: String,
    pub text_mode: String,
    pub asr_provider: String,
}

impl HistoryItem {
    pub fn new_for_test(id: i64, source_text: String, final_text: String) -> Self {
        Self {
            id,
            created_at: "2026-08-09T00:00:00Z".to_string(),
            source_text,
            final_text,
            text_mode: "Normal".to_string(),
            asr_provider: "mock".to_string(),
        }
    }
}
```

Create `src-tauri/src/services/preprocess.rs`:

```rust
pub fn process_normal_text(raw: &str) -> String {
    raw.trim().to_string()
}
```

Create `src-tauri/src/state.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeState {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}
```

- [ ] **Step 8: Install dependencies**

Run:

```bash
pnpm install
```

Expected: command exits successfully and creates `node_modules/` and `pnpm-lock.yaml`.

- [ ] **Step 9: Verify frontend skeleton**

Run:

```bash
pnpm build
```

Expected: TypeScript and Vite build complete successfully and create `dist/`.

- [ ] **Step 10: Verify Rust skeleton**

Run:

```bash
cd src-tauri && cargo test
```

Expected: Cargo compiles the Rust crate and reports zero or more passing tests with no compile errors.

- [ ] **Step 11: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.node.json src/main.tsx src/App.tsx src/test/setup.ts src/lib/types.ts src/lib/commands.ts src-tauri/Cargo.toml src-tauri/build.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/src/main.rs src-tauri/src/lib.rs src-tauri/src/commands/mod.rs src-tauri/src/commands/history.rs src-tauri/src/commands/preview.rs src-tauri/src/services/mod.rs src-tauri/src/services/db.rs src-tauri/src/services/preprocess.rs src-tauri/src/state.rs
git commit -m "feat: 初始化项目骨架"
```

---

## Task 2A: Backend Text Preprocessing

**Owner:** Backend Text Agent  
**Parallelization:** Can run after Task 1, in parallel with Task 2B, Task 2C, and Task 2D.

**Files:**
- Modify: `src-tauri/src/services/preprocess.rs`

- [ ] **Step 1: Replace preprocessing stub with failing tests and implementation shell**

Replace `src-tauri/src/services/preprocess.rs` with:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreprocessConfig {
    pub mode: TextMode,
    pub add_punctuation: bool,
    pub filter_words: bool,
    pub single_line: bool,
    pub custom_filter_words: Vec<String>,
}

impl Default for PreprocessConfig {
    fn default() -> Self {
        Self {
            mode: TextMode::Normal,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        }
    }
}

pub const DEFAULT_FILTER_WORDS: &[&str] = &[
    "嗯", "啊", "呃", "哦", "那个", "这个", "就是", "然后", "反正", "就是说",
];

pub fn process_text(raw: &str, config: &PreprocessConfig) -> String {
    let mut text = raw.to_string();

    if config.mode == TextMode::Raw {
        return text;
    }

    if config.filter_words && config.mode == TextMode::Normal {
        text = remove_filter_words(&text, config);
    }

    if config.single_line {
        text = normalize_single_line(&text);
    }

    if config.add_punctuation && config.mode == TextMode::Normal {
        text = add_terminal_punctuation(&text);
    }

    text.trim().to_string()
}

pub fn process_normal_text(raw: &str) -> String {
    process_text(raw, &PreprocessConfig::default())
}

fn remove_filter_words(text: &str, config: &PreprocessConfig) -> String {
    let mut result = text.to_string();
    let mut words: Vec<String> = DEFAULT_FILTER_WORDS.iter().map(|word| word.to_string()).collect();
    words.extend(config.custom_filter_words.iter().cloned());

    for word in words {
        result = result.replace(&word, " ");
    }

    result
}

fn normalize_single_line(text: &str) -> String {
    text.replace("\r\n", " ")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn add_terminal_punctuation(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let last = trimmed.chars().last().unwrap();
    if matches!(last, '。' | '！' | '？' | '.' | '!' | '?') {
        trimmed.to_string()
    } else {
        format!("{}。", trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_mode_filters_default_words_and_normalizes_to_single_line() {
        let config = PreprocessConfig::default();

        let result = process_text("嗯 这个  请帮我\n修改   这个函数", &config);

        assert_eq!(result, "请帮我 修改 函数。");
    }

    #[test]
    fn developer_mode_keeps_filler_words_but_normalizes_line_breaks() {
        let config = PreprocessConfig {
            mode: TextMode::Developer,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        };

        let result = process_text("然后 cargo\n test   这个命令", &config);

        assert_eq!(result, "然后 cargo test 这个命令");
    }

    #[test]
    fn raw_mode_returns_original_text_without_trimming() {
        let config = PreprocessConfig {
            mode: TextMode::Raw,
            add_punctuation: true,
            filter_words: true,
            single_line: true,
            custom_filter_words: Vec::new(),
        };

        let result = process_text("  嗯 第一行\n第二行  ", &config);

        assert_eq!(result, "  嗯 第一行\n第二行  ");
    }

    #[test]
    fn custom_filter_words_are_removed_in_normal_mode() {
        let config = PreprocessConfig {
            custom_filter_words: vec!["拜托".to_string()],
            ..PreprocessConfig::default()
        };

        let result = process_text("拜托 帮我重构", &config);

        assert_eq!(result, "帮我重构。");
    }

    #[test]
    fn existing_terminal_punctuation_is_preserved() {
        let config = PreprocessConfig::default();

        let result = process_text("请解释这个错误？", &config);

        assert_eq!(result, "请解释错误？");
    }
}
```

- [ ] **Step 2: Run focused Rust tests**

Run:

```bash
cd src-tauri && cargo test services::preprocess -- --nocapture
```

Expected: all five `services::preprocess` tests pass.

- [ ] **Step 3: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/src/services/preprocess.rs
git commit -m "feat: 添加文本预处理"
```

---

## Task 2B: Backend SQLite Persistence

**Owner:** Backend Storage Agent  
**Parallelization:** Can run after Task 1, in parallel with Task 2A, Task 2C, and Task 2D.

**Files:**
- Modify: `src-tauri/src/services/db.rs`

- [ ] **Step 1: Replace database stub with SQLite-backed history storage**

Replace `src-tauri/src/services/db.rs` with:

```rust
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryItem {
    pub id: i64,
    pub created_at: String,
    pub source_text: String,
    pub final_text: String,
    pub text_mode: String,
    pub asr_provider: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewHistoryItem {
    pub source_text: String,
    pub final_text: String,
    pub text_mode: String,
    pub asr_provider: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), rusqlite::Error> {
        self.conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source_text TEXT NOT NULL,
                final_text TEXT NOT NULL,
                text_mode TEXT NOT NULL,
                asr_provider TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS filter_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            "#,
        )?;

        self.seed_default_filter_words()?;
        Ok(())
    }

    fn seed_default_filter_words(&self) -> Result<(), rusqlite::Error> {
        let words = ["嗯", "啊", "呃", "哦", "那个", "这个", "就是", "然后", "反正", "就是说"];
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

        for word in words {
            self.conn.execute(
                "INSERT OR IGNORE INTO filter_words (word, is_default, created_at) VALUES (?1, 1, ?2)",
                params![word, now],
            )?;
        }

        Ok(())
    }

    pub fn insert_history(&self, item: NewHistoryItem) -> Result<HistoryItem, rusqlite::Error> {
        let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

        self.conn.execute(
            r#"
            INSERT INTO history (created_at, source_text, final_text, text_mode, asr_provider)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                created_at,
                item.source_text,
                item.final_text,
                item.text_mode,
                item.asr_provider,
            ],
        )?;

        let id = self.conn.last_insert_rowid();
        self.get_history_by_id(id)
    }

    pub fn list_history(&self) -> Result<Vec<HistoryItem>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, created_at, source_text, final_text, text_mode, asr_provider
            FROM history
            ORDER BY created_at DESC, id DESC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(HistoryItem {
                id: row.get(0)?,
                created_at: row.get(1)?,
                source_text: row.get(2)?,
                final_text: row.get(3)?,
                text_mode: row.get(4)?,
                asr_provider: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_history_by_id(&self, id: i64) -> Result<HistoryItem, rusqlite::Error> {
        self.conn.query_row(
            r#"
            SELECT id, created_at, source_text, final_text, text_mode, asr_provider
            FROM history
            WHERE id = ?1
            "#,
            params![id],
            |row| {
                Ok(HistoryItem {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    source_text: row.get(2)?,
                    final_text: row.get(3)?,
                    text_mode: row.get(4)?,
                    asr_provider: row.get(5)?,
                })
            },
        )
    }

    pub fn count_default_filter_words(&self) -> Result<i64, rusqlite::Error> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM filter_words WHERE is_default = 1",
            [],
            |row| row.get(0),
        )
    }
}

impl HistoryItem {
    pub fn new_for_test(id: i64, source_text: String, final_text: String) -> Self {
        Self {
            id,
            created_at: "2026-08-09T00:00:00Z".to_string(),
            source_text,
            final_text,
            text_mode: "Normal".to_string(),
            asr_provider: "mock".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_schema_and_default_filter_words() {
        let db = Database::in_memory().expect("database opens");

        let count = db.count_default_filter_words().expect("count succeeds");

        assert_eq!(count, 10);
    }

    #[test]
    fn inserts_and_lists_history_newest_first() {
        let db = Database::in_memory().expect("database opens");

        let first = db
            .insert_history(NewHistoryItem {
                source_text: "原始一".to_string(),
                final_text: "最终一".to_string(),
                text_mode: "Normal".to_string(),
                asr_provider: "mock".to_string(),
            })
            .expect("first insert succeeds");
        let second = db
            .insert_history(NewHistoryItem {
                source_text: "原始二".to_string(),
                final_text: "最终二".to_string(),
                text_mode: "Developer".to_string(),
                asr_provider: "mock".to_string(),
            })
            .expect("second insert succeeds");

        let items = db.list_history().expect("list succeeds");

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, second.id);
        assert_eq!(items[1].id, first.id);
        assert_eq!(items[0].final_text, "最终二");
    }
}
```

- [ ] **Step 2: Run focused Rust tests**

Run:

```bash
cd src-tauri && cargo test services::db -- --nocapture
```

Expected: both `services::db` tests pass.

- [ ] **Step 3: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/src/services/db.rs
git commit -m "feat: 添加本地历史存储"
```

---

## Task 2C: Backend App State Machine

**Owner:** Backend State Agent  
**Parallelization:** Can run after Task 1, in parallel with Task 2A, Task 2B, and Task 2D.

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Replace state stub with deterministic transitions**

Replace `src-tauri/src/state.rs` with:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeState {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeEvent {
    HotkeyPressed,
    HotkeyReleasedWithValidAudio,
    HotkeyReleasedTooShort,
    RecognitionSucceeded,
    RecognitionFailed,
    ConfirmedPreview,
    Cancelled,
    TogglePause,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateError {
    InvalidTransition { from: RuntimeState, event: RuntimeEvent },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppRuntime {
    state: RuntimeState,
}

impl Default for AppRuntime {
    fn default() -> Self {
        Self { state: RuntimeState::Idle }
    }
}

impl AppRuntime {
    pub fn state(&self) -> &RuntimeState {
        &self.state
    }

    pub fn transition(&mut self, event: RuntimeEvent) -> Result<RuntimeState, StateError> {
        let next = match (&self.state, &event) {
            (RuntimeState::Idle, RuntimeEvent::HotkeyPressed) => RuntimeState::Recording,
            (RuntimeState::Recording, RuntimeEvent::HotkeyReleasedWithValidAudio) => RuntimeState::Recognizing,
            (RuntimeState::Recording, RuntimeEvent::HotkeyReleasedTooShort) => RuntimeState::Idle,
            (RuntimeState::Recording, RuntimeEvent::Cancelled) => RuntimeState::Idle,
            (RuntimeState::Recognizing, RuntimeEvent::RecognitionSucceeded) => RuntimeState::Preview,
            (RuntimeState::Recognizing, RuntimeEvent::RecognitionFailed) => RuntimeState::Idle,
            (RuntimeState::Preview, RuntimeEvent::ConfirmedPreview) => RuntimeState::Idle,
            (RuntimeState::Preview, RuntimeEvent::Cancelled) => RuntimeState::Idle,
            (RuntimeState::Idle, RuntimeEvent::TogglePause) => RuntimeState::Paused,
            (RuntimeState::Recording, RuntimeEvent::TogglePause) => RuntimeState::Paused,
            (RuntimeState::Recognizing, RuntimeEvent::TogglePause) => RuntimeState::Paused,
            (RuntimeState::Preview, RuntimeEvent::TogglePause) => RuntimeState::Paused,
            (RuntimeState::Paused, RuntimeEvent::TogglePause) => RuntimeState::Idle,
            _ => {
                return Err(StateError::InvalidTransition {
                    from: self.state.clone(),
                    event,
                });
            }
        };

        self.state = next.clone();
        Ok(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_recording_to_preview_to_idle_flow() {
        let mut runtime = AppRuntime::default();

        assert_eq!(runtime.transition(RuntimeEvent::HotkeyPressed), Ok(RuntimeState::Recording));
        assert_eq!(
            runtime.transition(RuntimeEvent::HotkeyReleasedWithValidAudio),
            Ok(RuntimeState::Recognizing)
        );
        assert_eq!(
            runtime.transition(RuntimeEvent::RecognitionSucceeded),
            Ok(RuntimeState::Preview)
        );
        assert_eq!(
            runtime.transition(RuntimeEvent::ConfirmedPreview),
            Ok(RuntimeState::Idle)
        );
    }

    #[test]
    fn too_short_recording_returns_to_idle() {
        let mut runtime = AppRuntime::default();

        runtime.transition(RuntimeEvent::HotkeyPressed).expect("starts recording");
        let state = runtime
            .transition(RuntimeEvent::HotkeyReleasedTooShort)
            .expect("short audio is discarded");

        assert_eq!(state, RuntimeState::Idle);
    }

    #[test]
    fn pause_toggle_disables_and_restores_idle() {
        let mut runtime = AppRuntime::default();

        assert_eq!(runtime.transition(RuntimeEvent::TogglePause), Ok(RuntimeState::Paused));
        assert_eq!(runtime.transition(RuntimeEvent::TogglePause), Ok(RuntimeState::Idle));
    }

    #[test]
    fn invalid_confirm_from_idle_is_rejected() {
        let mut runtime = AppRuntime::default();

        let result = runtime.transition(RuntimeEvent::ConfirmedPreview);

        assert_eq!(
            result,
            Err(StateError::InvalidTransition {
                from: RuntimeState::Idle,
                event: RuntimeEvent::ConfirmedPreview,
            })
        );
    }
}
```

- [ ] **Step 2: Run focused Rust tests**

Run:

```bash
cd src-tauri && cargo test state -- --nocapture
```

Expected: all four `state` tests pass.

- [ ] **Step 3: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/src/state.rs
git commit -m "feat: 添加应用状态机"
```

---

## Task 2D: Frontend Shell, Preview, and History UI

**Owner:** Frontend Agent  
**Parallelization:** Can run after Task 1, in parallel with Task 2A, Task 2B, and Task 2C.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/PreviewPopup.tsx`
- Create: `src/components/PreviewPopup.test.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/pages/History.tsx`
- Create: `src/pages/Settings.tsx`

- [ ] **Step 1: Create preview popup component with tests**

Create `src/components/PreviewPopup.tsx`:

```tsx
import { useState } from "react";
import type { ConfirmPreviewInput, PreviewDraft } from "../lib/types";

interface PreviewPopupProps {
  draft: PreviewDraft | null;
  onConfirm: (input: ConfirmPreviewInput) => Promise<void>;
  onCancel: () => void;
}

export default function PreviewPopup({ draft, onConfirm, onCancel }: PreviewPopupProps) {
  const [finalText, setFinalText] = useState(draft?.processedText ?? "");
  const [isSaving, setIsSaving] = useState(false);

  if (!draft) {
    return null;
  }

  async function confirm() {
    setIsSaving(true);
    await onConfirm({
      sourceText: draft.sourceText,
      finalText,
      textMode: draft.textMode,
      asrProvider: draft.asrProvider,
    });
    setIsSaving(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      void confirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <section aria-label="语音输入预览" style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <h2>语音输入预览</h2>
      <textarea
        aria-label="预览文本"
        value={finalText}
        onChange={(event) => setFinalText(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={onCancel}>放弃</button>
        <button type="button" onClick={confirm} disabled={isSaving}>
          {isSaving ? "保存中…" : "确认上屏"}
        </button>
      </div>
    </section>
  );
}
```

Create `src/components/PreviewPopup.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PreviewPopup from "./PreviewPopup";
import type { PreviewDraft } from "../lib/types";

const draft: PreviewDraft = {
  sourceText: "嗯 请帮我修改",
  processedText: "请帮我修改。",
  textMode: "Normal",
  asrProvider: "mock",
};

describe("PreviewPopup", () => {
  it("renders processed text and confirms edited text", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<PreviewPopup draft={draft} onConfirm={onConfirm} onCancel={() => undefined} />);

    const textarea = screen.getByLabelText("预览文本");
    await user.clear(textarea);
    await user.type(textarea, "最终文本");
    await user.click(screen.getByRole("button", { name: "确认上屏" }));

    expect(onConfirm).toHaveBeenCalledWith({
      sourceText: "嗯 请帮我修改",
      finalText: "最终文本",
      textMode: "Normal",
      asrProvider: "mock",
    });
  });

  it("calls cancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PreviewPopup draft={draft} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByLabelText("预览文本"));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Create status badge and pages**

Create `src/components/StatusBadge.tsx`:

```tsx
import type { AppStatus } from "../lib/types";

interface StatusBadgeProps {
  status: AppStatus;
}

const labels: Record<AppStatus, string> = {
  Idle: "空闲",
  Recording: "录音中",
  Recognizing: "识别中",
  Preview: "预览中",
  Paused: "已暂停",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span aria-label="应用状态" style={{ border: "1px solid #ddd", borderRadius: 999, padding: "4px 10px" }}>
      {labels[status]}
    </span>
  );
}
```

Create `src/pages/History.tsx`:

```tsx
import type { HistoryItem } from "../lib/types";

interface HistoryProps {
  items: HistoryItem[];
}

export default function History({ items }: HistoryProps) {
  return (
    <section aria-label="历史记录">
      <h2>历史记录</h2>
      {items.length === 0 ? (
        <p>暂无历史记录。</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.created_at}</strong>
              <p>{item.final_text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Create `src/pages/Settings.tsx`:

```tsx
export default function Settings() {
  return (
    <section aria-label="设置">
      <h2>设置</h2>
      <label>
        ASR 服务商
        <select defaultValue="mock">
          <option value="mock">Mock 本地识别</option>
        </select>
      </label>
      <p>当前 MVP 使用 Mock 本地识别链路验证 UI、预处理、状态和历史存储。</p>
    </section>
  );
}
```

- [ ] **Step 3: Replace app shell with interactive MVP flow**

Replace `src/App.tsx` with:

```tsx
import { useEffect, useState } from "react";
import PreviewPopup from "./components/PreviewPopup";
import StatusBadge from "./components/StatusBadge";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { confirmPreview, createMockPreview, getAppStatus, listHistory } from "./lib/commands";
import type { AppStatus, ConfirmPreviewInput, HistoryItem, PreviewDraft } from "./lib/types";

type Tab = "history" | "settings";

export default function App() {
  const [status, setStatus] = useState<AppStatus>("Idle");
  const [tab, setTab] = useState<Tab>("history");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draft, setDraft] = useState<PreviewDraft | null>(null);
  const [mockText, setMockText] = useState("嗯 请帮我修改这个函数");

  useEffect(() => {
    void getAppStatus().then(setStatus);
    void listHistory().then(setHistory);
  }, []);

  async function startMockFlow() {
    setStatus("Recognizing");
    const nextDraft = await createMockPreview(mockText);
    setDraft(nextDraft);
    setStatus("Preview");
  }

  async function handleConfirm(input: ConfirmPreviewInput) {
    const saved = await confirmPreview(input);
    setHistory((items) => [saved, ...items]);
    setDraft(null);
    setStatus("Idle");
  }

  function handleCancel() {
    setDraft(null);
    setStatus("Idle");
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>TerminalVoice</h1>
          <p>Mock 端到端链路：输入模拟识别文本 → 预处理 → 预览编辑 → 写入历史。</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <section aria-label="模拟识别" style={{ marginTop: 16, marginBottom: 16 }}>
        <label>
          模拟 ASR 原始文本
          <input
            aria-label="模拟 ASR 原始文本"
            value={mockText}
            onChange={(event) => setMockText(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <button type="button" onClick={startMockFlow} style={{ marginTop: 8 }}>
          生成预览
        </button>
      </section>

      <PreviewPopup draft={draft} onConfirm={handleConfirm} onCancel={handleCancel} />

      <nav style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button type="button" onClick={() => setTab("history")}>历史记录</button>
        <button type="button" onClick={() => setTab("settings")}>设置</button>
      </nav>

      <div style={{ marginTop: 16 }}>
        {tab === "history" ? <History items={history} /> : <Settings />}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run focused frontend tests**

Run:

```bash
pnpm test src/components/PreviewPopup.test.tsx
```

Expected: both `PreviewPopup` tests pass.

- [ ] **Step 5: Run frontend build**

Run:

```bash
pnpm build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 6: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src/App.tsx src/components/PreviewPopup.tsx src/components/PreviewPopup.test.tsx src/components/StatusBadge.tsx src/pages/History.tsx src/pages/Settings.tsx
git commit -m "feat: 添加预览和历史界面"
```

---

## Task 3: IPC Integration and Mock End-to-End Flow

**Owner:** Coordinator Agent  
**Parallelization:** Runs after Tasks 2A, 2B, 2C, and 2D complete.

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/history.rs`
- Modify: `src-tauri/src/commands/preview.rs`

- [ ] **Step 1: Register managed database and runtime state**

Replace `src-tauri/src/lib.rs` with:

```rust
pub mod commands;
pub mod services;
pub mod state;

use services::db::Database;
use state::AppRuntime;
use std::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
            std::fs::create_dir_all(&data_dir)
                .map_err(|error| format!("failed to create app data dir: {error}"))?;
            let db_path = data_dir.join("terminalvoice.db");
            let db = Database::open(&db_path)
                .map_err(|error| format!("failed to open database: {error}"))?;

            app.manage(Mutex::new(db));
            app.manage(Mutex::new(AppRuntime::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preview::get_app_status,
            commands::preview::create_mock_preview,
            commands::preview::confirm_preview,
            commands::history::list_history,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TerminalVoice");
}
```

- [ ] **Step 2: Connect history command to SQLite**

Replace `src-tauri/src/commands/history.rs` with:

```rust
use crate::services::db::{Database, HistoryItem};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_history(db: State<'_, Mutex<Database>>) -> Result<Vec<HistoryItem>, String> {
    let db = db.lock().map_err(|error| error.to_string())?;
    db.list_history().map_err(|error| error.to_string())
}
```

- [ ] **Step 3: Connect preview commands to preprocessor, state, and SQLite**

Replace `src-tauri/src/commands/preview.rs` with:

```rust
use crate::services::db::{Database, HistoryItem, NewHistoryItem};
use crate::services::preprocess::{process_text, PreprocessConfig, TextMode as BackendTextMode};
use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AppStatus {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}

impl From<&RuntimeState> for AppStatus {
    fn from(value: &RuntimeState) -> Self {
        match value {
            RuntimeState::Idle => Self::Idle,
            RuntimeState::Recording => Self::Recording,
            RuntimeState::Recognizing => Self::Recognizing,
            RuntimeState::Preview => Self::Preview,
            RuntimeState::Paused => Self::Paused,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TextMode {
    Normal,
    Developer,
    Raw,
}

impl TextMode {
    fn as_storage_value(&self) -> &'static str {
        match self {
            Self::Normal => "Normal",
            Self::Developer => "Developer",
            Self::Raw => "Raw",
        }
    }

    fn to_backend_mode(&self) -> BackendTextMode {
        match self {
            Self::Normal => BackendTextMode::Normal,
            Self::Developer => BackendTextMode::Developer,
            Self::Raw => BackendTextMode::Raw,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PreviewDraft {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "processedText")]
    pub processed_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfirmPreviewInput {
    #[serde(rename = "sourceText")]
    pub source_text: String,
    #[serde(rename = "finalText")]
    pub final_text: String,
    #[serde(rename = "textMode")]
    pub text_mode: TextMode,
    #[serde(rename = "asrProvider")]
    pub asr_provider: String,
}

#[tauri::command]
pub fn get_app_status(runtime: State<'_, Mutex<AppRuntime>>) -> Result<AppStatus, String> {
    let runtime = runtime.lock().map_err(|error| error.to_string())?;
    Ok(AppStatus::from(runtime.state()))
}

#[tauri::command]
pub fn create_mock_preview(
    raw_text: String,
    runtime: State<'_, Mutex<AppRuntime>>,
) -> Result<PreviewDraft, String> {
    let mut runtime = runtime.lock().map_err(|error| error.to_string())?;

    if matches!(runtime.state(), RuntimeState::Idle) {
        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
    }
    if matches!(runtime.state(), RuntimeState::Recording) {
        runtime
            .transition(RuntimeEvent::HotkeyReleasedWithValidAudio)
            .map_err(|error| format!("invalid state transition: {error:?}"))?;
    }

    let text_mode = TextMode::Normal;
    let config = PreprocessConfig {
        mode: text_mode.to_backend_mode(),
        add_punctuation: true,
        filter_words: true,
        single_line: true,
        custom_filter_words: Vec::new(),
    };
    let processed_text = process_text(&raw_text, &config);

    runtime
        .transition(RuntimeEvent::RecognitionSucceeded)
        .map_err(|error| format!("invalid state transition: {error:?}"))?;

    Ok(PreviewDraft {
        source_text: raw_text,
        processed_text,
        text_mode,
        asr_provider: "mock".to_string(),
    })
}

#[tauri::command]
pub fn confirm_preview(
    input: ConfirmPreviewInput,
    db: State<'_, Mutex<Database>>,
    runtime: State<'_, Mutex<AppRuntime>>,
) -> Result<HistoryItem, String> {
    let saved = {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.insert_history(NewHistoryItem {
            source_text: input.source_text,
            final_text: input.final_text,
            text_mode: input.text_mode.as_storage_value().to_string(),
            asr_provider: input.asr_provider,
        })
        .map_err(|error| error.to_string())?
    };

    let mut runtime = runtime.lock().map_err(|error| error.to_string())?;
    runtime
        .transition(RuntimeEvent::ConfirmedPreview)
        .map_err(|error| format!("invalid state transition: {error:?}"))?;

    Ok(saved)
}
```

- [ ] **Step 4: Run full Rust test suite**

Run:

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass.

- [ ] **Step 5: Run frontend tests and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: all frontend tests pass and the frontend build succeeds.

- [ ] **Step 6: Run Tauri development app for manual mock flow verification**

Run:

```bash
pnpm tauri dev
```

Expected:

1. TerminalVoice desktop window opens.
2. The status badge initially shows `空闲`.
3. Clicking `生成预览` opens `语音输入预览`.
4. The default mock input `嗯 请帮我修改这个函数` becomes `请帮我修改函数。`.
5. Editing the preview text and clicking `确认上屏` closes the preview area.
6. The edited text appears as the newest item in `历史记录`.
7. Restarting the app keeps the saved history because it is stored in `terminalvoice.db` under the app data directory.

- [ ] **Step 7: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands/history.rs src-tauri/src/commands/preview.rs
git commit -m "feat: 打通模拟预览流程"
```

---

## Task 4: Validation Checklist and Follow-Up Plan Boundaries

**Owner:** Coordinator Agent  
**Parallelization:** Runs after Task 3.

**Files:**
- Create: `docs/superpowers/plans/2026-08-09-terminalvoice-follow-up-boundaries.md`

- [ ] **Step 1: Create follow-up boundary document**

Create `docs/superpowers/plans/2026-08-09-terminalvoice-follow-up-boundaries.md`:

```markdown
# TerminalVoice Follow-Up Boundaries

This MVP baseline intentionally proves the project structure, shared contracts, text preprocessing, state transitions, frontend preview editing, and SQLite history storage.

Follow-up plans should be split by subsystem:

1. Windows hotkey and recording plan
   - Files: `src-tauri/src/services/hotkey.rs`, `src-tauri/src/services/recorder.rs`, `src-tauri/src/commands/audio.rs`
   - Acceptance: F8 long press starts recording, short press discards, ESC cancels, WAV buffer can be generated.

2. Real ASR provider plan
   - Files: `src-tauri/src/services/asr_client.rs`, `src-tauri/src/commands/asr.rs`, settings UI files
   - Acceptance: one configured provider returns recognized text, retries once, maps network/key/quota/server errors.

3. Windows text injection plan
   - Files: `src-tauri/src/services/injector.rs`, `src-tauri/src/commands/inject.rs`
   - Acceptance: clipboard paste works in Notepad, Windows Terminal, and VS Code; failure leaves text in clipboard.

4. Tray and lifecycle plan
   - Files: `src-tauri/src/tray.rs`, `src-tauri/src/lib.rs`
   - Acceptance: tray icon appears, left click opens window, pause toggles state, exit releases resources.

5. Settings and secure configuration plan
   - Files: `src-tauri/src/services/crypto.rs`, `src-tauri/src/commands/config.rs`, `src/pages/Settings.tsx`
   - Acceptance: API key is encrypted before database storage, settings survive restart, logs never show secrets.

6. Packaging and acceptance plan
   - Files: `src-tauri/tauri.conf.json`, installer configuration files, PRD acceptance checklist
   - Acceptance: Windows installer builds and the PRD Section 14 checklist is executed.
```

- [ ] **Step 2: Run final verification commands**

Run:

```bash
pnpm test
pnpm build
cd src-tauri && cargo test
```

Expected:

- Frontend tests pass.
- Frontend build succeeds.
- Rust tests pass.

- [ ] **Step 3: Manually verify no plan claims full PRD completion**

Open this plan and confirm these statements are present:

- The MVP uses a mock recognition flow.
- Real microphone capture is a follow-up plan.
- Real ASR provider integration is a follow-up plan.
- Windows text injection is a follow-up plan.
- Tray, secure configuration, and installer packaging are follow-up plans.

Expected: all five statements are present, so the MVP scope is honest and testable.

- [ ] **Step 4: Optional commit after explicit human authorization**

Only run if the human explicitly authorizes commits and the directory is a Git repository:

```bash
git add docs/superpowers/plans/2026-08-09-terminalvoice-follow-up-boundaries.md
git commit -m "docs: 记录后续开发边界"
```

---

## Integration Verification Matrix

| Area | Command or action | Expected result |
| :--- | :--- | :--- |
| Rust preprocessing | `cd src-tauri && cargo test services::preprocess` | All preprocessing tests pass |
| Rust database | `cd src-tauri && cargo test services::db` | SQLite schema and history tests pass |
| Rust state | `cd src-tauri && cargo test state` | State transition tests pass |
| Frontend preview | `pnpm test src/components/PreviewPopup.test.tsx` | Preview edit and ESC tests pass |
| Frontend build | `pnpm build` | TypeScript and Vite build succeed |
| Full Rust suite | `cd src-tauri && cargo test` | All Rust tests pass |
| Manual desktop flow | `pnpm tauri dev` | Mock preview can be saved to history |

---

## Self-Review

### 1. Spec Coverage

Covered in this plan:

- Tauri + React + Rust project skeleton from `TerminalVoice_PRD_V1.0.md` and `docs/ARCHITECTURE.md`.
- Deterministic text preprocessing for Normal, Developer, and Raw modes.
- SQLite tables for `config`, `history`, and `filter_words`.
- Local history write and list path.
- Runtime state transitions for Idle, Recording, Recognizing, Preview, and Paused.
- Preview editing UI with confirm and cancel behavior.
- A mock end-to-end flow that verifies contracts before OS-specific work starts.

Not covered by this MVP plan, with explicit follow-up boundaries:

- Global F8 hotkey registration.
- Microphone recording via Windows audio stack.
- Real cloud ASR provider integration.
- Clipboard or SendInput text injection into other applications.
- System tray behavior.
- DPAPI encryption.
- Logging and log rotation.
- MSI installer packaging.
- Full PRD Section 14 manual acceptance.

This scope split is intentional because the current repository has only documents and the PRD spans multiple independent subsystems. The MVP produces working, testable software before the OS-specific agents start.

### 2. Placeholder Scan

This plan avoids unresolved implementation markers. Every code-changing step provides concrete file content or a concrete replacement block. Follow-up work is listed as separate bounded plans, not as unfinished code inside this plan.

### 3. Type Consistency

The TypeScript command payloads in `src/lib/types.ts` match the Rust `PreviewDraft`, `ConfirmPreviewInput`, and `HistoryItem` serialized field names. The command names in `src/lib/commands.ts` match the Tauri command functions registered in `src-tauri/src/lib.rs`.

---

## Execution Notes

- Use `superpowers:subagent-driven-development` for implementation because Tasks 2A through 2D are independent after Task 1.
- Do not run optional commit commands unless the human explicitly authorizes Git commits.
- Do not widen this plan to real hotkey, recorder, ASR, injection, tray, or installer work. Those are deliberately separated to keep each subsystem testable and reviewable.
