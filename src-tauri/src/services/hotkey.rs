use rdev::{listen, Event, EventType, Key};
use std::sync::mpsc::Sender;
use std::thread::{self, JoinHandle};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotkeyEvent {
    Pressed,
    Released,
    Cancelled,
    ListenerFailed(String),
    RewritePressed,
    RewriteReleased,
    TtsToggle,
    Translate,
}

#[derive(Debug, Default)]
pub struct HotkeyEdgeState {
    pressed: bool,
    shift_held: bool,
    rewrite_mode: bool,
    alt_held: bool,
}

impl HotkeyEdgeState {
    pub fn handle(&mut self, event: &EventType) -> Option<HotkeyEvent> {
        match event {
            EventType::KeyPress(Key::ShiftLeft) | EventType::KeyPress(Key::ShiftRight) => {
                self.shift_held = true;
                None
            }
            EventType::KeyRelease(Key::ShiftLeft) | EventType::KeyRelease(Key::ShiftRight) => {
                self.shift_held = false;
                None
            }
            EventType::KeyPress(Key::AltGr) if !self.pressed && !self.rewrite_mode => {
                if self.shift_held {
                    self.rewrite_mode = true;
                    Some(HotkeyEvent::RewritePressed)
                } else {
                    self.pressed = true;
                    Some(HotkeyEvent::Pressed)
                }
            }
            EventType::KeyRelease(Key::AltGr) if self.pressed => {
                self.pressed = false;
                Some(HotkeyEvent::Released)
            }
            EventType::KeyRelease(Key::AltGr) if self.rewrite_mode => {
                self.rewrite_mode = false;
                Some(HotkeyEvent::RewriteReleased)
            }
            EventType::KeyPress(Key::Alt) => {
                self.alt_held = true;
                None
            }
            EventType::KeyRelease(Key::Alt) => {
                self.alt_held = false;
                None
            }
            EventType::KeyPress(Key::Num1) if self.alt_held => Some(HotkeyEvent::TtsToggle),
            EventType::KeyPress(Key::Num2) if self.alt_held => Some(HotkeyEvent::Translate),
            EventType::KeyPress(Key::Escape) => Some(HotkeyEvent::Cancelled),
            _ => None,
        }
    }
}

pub fn spawn_listener(sender: Sender<HotkeyEvent>) -> Result<JoinHandle<()>, String> {
    thread::Builder::new()
        .name("terminalvoice-hotkey".to_string())
        .spawn(move || {
            let failure_sender = sender.clone();
            let mut edge = HotkeyEdgeState::default();
            let callback = move |event: Event| {
                if let Some(mapped) = edge.handle(&event.event_type) {
                    let _ = sender.send(mapped);
                }
            };
            if let Err(error) = listen(callback) {
                let message = format!("{error:?}");
                eprintln!("[TerminalVoice] 全局热键监听失败: {message}");
                let _ = failure_sender.send(HotkeyEvent::ListenerFailed(message));
            }
        })
        .map_err(|error| format!("failed to spawn hotkey listener: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{AppRuntime, RuntimeEvent, RuntimeState};

    #[test]
    fn edge_state_debounces_repeated_press_and_release() {
        let mut state = HotkeyEdgeState::default();
        assert_eq!(
            state.handle(&EventType::KeyPress(Key::AltGr)),
            Some(HotkeyEvent::Pressed)
        );
        assert_eq!(state.handle(&EventType::KeyPress(Key::AltGr)), None);
        assert_eq!(
            state.handle(&EventType::KeyRelease(Key::AltGr)),
            Some(HotkeyEvent::Released)
        );
        assert_eq!(state.handle(&EventType::KeyRelease(Key::AltGr)), None);
    }

    #[test]
    fn shift_plus_altgr_triggers_rewrite_mode() {
        let mut state = HotkeyEdgeState::default();
        // Press Shift first
        assert_eq!(
            state.handle(&EventType::KeyPress(Key::ShiftLeft)),
            None
        );
        // Then press AltGr → should emit RewritePressed
        assert_eq!(
            state.handle(&EventType::KeyPress(Key::AltGr)),
            Some(HotkeyEvent::RewritePressed)
        );
        // Repeated AltGr press should be ignored
        assert_eq!(state.handle(&EventType::KeyPress(Key::AltGr)), None);
        // Release AltGr → should emit RewriteReleased
        assert_eq!(
            state.handle(&EventType::KeyRelease(Key::AltGr)),
            Some(HotkeyEvent::RewriteReleased)
        );
    }

    #[test]
    fn altgr_without_shift_triggers_normal_mode() {
        let mut state = HotkeyEdgeState::default();
        assert_eq!(
            state.handle(&EventType::KeyPress(Key::AltGr)),
            Some(HotkeyEvent::Pressed)
        );
        assert_eq!(
            state.handle(&EventType::KeyRelease(Key::AltGr)),
            Some(HotkeyEvent::Released)
        );
    }

    #[test]
    fn paused_runtime_ignores_hotkey_pressed() {
        let mut runtime = AppRuntime::default();
        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("pause transition");
        assert_eq!(runtime.state(), &RuntimeState::Paused);
        assert!(runtime.transition(RuntimeEvent::HotkeyPressed).is_err());
    }
}
