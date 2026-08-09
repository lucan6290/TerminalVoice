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
