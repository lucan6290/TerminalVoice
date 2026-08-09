#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeState {
    Idle,
    Recording,
    Recognizing,
    Preview,
    Paused,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateError {
    InvalidTransition { from: RuntimeState, event: RuntimeEvent },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
                    from: self.state,
                    event,
                });
            }
        };

        self.state = next;
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
