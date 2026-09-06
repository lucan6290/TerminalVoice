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
    /// 识别完成后直接注入（跳过预览窗口），Recognizing/Preview → Idle
    DirectInjectSucceeded,
    ConfirmedPreview,
    Cancelled,
    TogglePause,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateError {
    InvalidTransition {
        from: RuntimeState,
        event: RuntimeEvent,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppRuntime {
    state: RuntimeState,
    paused_from: Option<RuntimeState>,
    rewrite_mode: bool,
}

impl Default for AppRuntime {
    fn default() -> Self {
        Self {
            state: RuntimeState::Idle,
            paused_from: None,
            rewrite_mode: false,
        }
    }
}

impl AppRuntime {
    pub fn state(&self) -> &RuntimeState {
        &self.state
    }

    pub fn is_rewrite_mode(&self) -> bool {
        self.rewrite_mode
    }

    pub fn set_rewrite_mode(&mut self, mode: bool) {
        self.rewrite_mode = mode;
    }

    pub fn transition(&mut self, event: RuntimeEvent) -> Result<RuntimeState, StateError> {
        let next = match (&self.state, &event) {
            (RuntimeState::Idle, RuntimeEvent::HotkeyPressed) => RuntimeState::Recording,
            (RuntimeState::Recording, RuntimeEvent::HotkeyReleasedWithValidAudio) => {
                RuntimeState::Recognizing
            }
            (RuntimeState::Recording, RuntimeEvent::HotkeyReleasedTooShort) => RuntimeState::Idle,
            (RuntimeState::Recording, RuntimeEvent::Cancelled) => RuntimeState::Idle,
            (RuntimeState::Recognizing, RuntimeEvent::RecognitionSucceeded) => {
                RuntimeState::Preview
            }
            (RuntimeState::Recognizing, RuntimeEvent::RecognitionFailed) => RuntimeState::Idle,
            (RuntimeState::Recognizing, RuntimeEvent::DirectInjectSucceeded) => RuntimeState::Idle,
            (RuntimeState::Preview, RuntimeEvent::DirectInjectSucceeded) => RuntimeState::Idle,
            (RuntimeState::Preview, RuntimeEvent::ConfirmedPreview) => RuntimeState::Idle,
            (RuntimeState::Preview, RuntimeEvent::Cancelled) => RuntimeState::Idle,
            (current, RuntimeEvent::TogglePause) if *current != RuntimeState::Paused => {
                self.paused_from = Some(*current);
                RuntimeState::Paused
            }
            (RuntimeState::Paused, RuntimeEvent::TogglePause) => {
                self.paused_from.take().unwrap_or(RuntimeState::Idle)
            }
            _ => {
                return Err(StateError::InvalidTransition {
                    from: self.state,
                    event,
                });
            }
        };

        self.state = next;
        if next != RuntimeState::Paused {
            self.paused_from = None;
        }
        Ok(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_recording_to_preview_to_idle_flow() {
        let mut runtime = AppRuntime::default();

        assert_eq!(
            runtime.transition(RuntimeEvent::HotkeyPressed),
            Ok(RuntimeState::Recording)
        );
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

        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .expect("starts recording");
        let state = runtime
            .transition(RuntimeEvent::HotkeyReleasedTooShort)
            .expect("short audio is discarded");

        assert_eq!(state, RuntimeState::Idle);
    }

    #[test]
    fn pause_toggle_disables_and_restores_idle() {
        let mut runtime = AppRuntime::default();

        assert_eq!(
            runtime.transition(RuntimeEvent::TogglePause),
            Ok(RuntimeState::Paused)
        );
        assert_eq!(
            runtime.transition(RuntimeEvent::TogglePause),
            Ok(RuntimeState::Idle)
        );
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

    #[test]
    fn pause_restores_previous_recording_state() {
        let mut runtime = AppRuntime::default();

        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .expect("starts recording");
        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("pauses");
        assert_eq!(*runtime.state(), RuntimeState::Paused);

        let restored = runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("unpauses");
        assert_eq!(restored, RuntimeState::Recording);
    }

    #[test]
    fn pause_restores_previous_recognizing_state() {
        let mut runtime = AppRuntime::default();

        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .expect("starts recording");
        runtime
            .transition(RuntimeEvent::HotkeyReleasedWithValidAudio)
            .expect("starts recognizing");
        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("pauses");

        let restored = runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("unpauses");
        assert_eq!(restored, RuntimeState::Recognizing);
    }

    #[test]
    fn pause_clears_paused_from_on_confirmed() {
        let mut runtime = AppRuntime::default();

        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .expect("starts recording");
        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("pauses");
        runtime
            .transition(RuntimeEvent::ConfirmedPreview)
            .expect_err("should not confirm from pause");

        runtime
            .transition(RuntimeEvent::TogglePause)
            .expect("unpauses to recording");
        runtime
            .transition(RuntimeEvent::HotkeyReleasedWithValidAudio)
            .expect("starts recognizing");
        runtime
            .transition(RuntimeEvent::RecognitionSucceeded)
            .expect("preview ready");
        runtime
            .transition(RuntimeEvent::ConfirmedPreview)
            .expect("confirmed");

        assert_eq!(*runtime.state(), RuntimeState::Idle);
    }

    #[test]
    fn rewrite_mode_flag_works() {
        let mut runtime = AppRuntime::default();
        assert!(!runtime.is_rewrite_mode());
        runtime.set_rewrite_mode(true);
        assert!(runtime.is_rewrite_mode());
        runtime.set_rewrite_mode(false);
        assert!(!runtime.is_rewrite_mode());
    }

    #[test]
    fn direct_inject_from_preview_returns_to_idle() {
        let mut runtime = AppRuntime::default();

        runtime
            .transition(RuntimeEvent::HotkeyPressed)
            .expect("starts recording");
        runtime
            .transition(RuntimeEvent::HotkeyReleasedWithValidAudio)
            .expect("starts recognizing");
        runtime
            .transition(RuntimeEvent::RecognitionSucceeded)
            .expect("preview ready");
        assert_eq!(*runtime.state(), RuntimeState::Preview);

        // skipPreview 路径：从 Preview 直接注入后回到 Idle
        let state = runtime
            .transition(RuntimeEvent::DirectInjectSucceeded)
            .expect("direct inject from preview");
        assert_eq!(state, RuntimeState::Idle);
    }
}
