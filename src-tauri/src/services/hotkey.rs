use rdev::{listen, Event, EventType, Key};
use std::sync::mpsc::Sender;
use std::thread::{self, JoinHandle};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotkeyEvent {
    Pressed,
    Released,
    Cancelled,
    ListenerFailed(String),
}

#[derive(Debug, Default)]
pub struct HotkeyEdgeState {
    pressed: bool,
}

impl HotkeyEdgeState {
    pub fn handle(&mut self, event: &EventType) -> Option<HotkeyEvent> {
        match event {
            EventType::KeyPress(Key::AltGr) if !self.pressed => {
                self.pressed = true;
                Some(HotkeyEvent::Pressed)
            }
            EventType::KeyRelease(Key::AltGr) if self.pressed => {
                self.pressed = false;
                Some(HotkeyEvent::Released)
            }
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
    fn paused_runtime_ignores_hotkey_pressed() {
        let mut runtime = AppRuntime::default();
        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("pause transition");
        assert_eq!(runtime.state(), &RuntimeState::Paused);
        assert!(runtime.transition(RuntimeEvent::HotkeyPressed).is_err());
    }
}
