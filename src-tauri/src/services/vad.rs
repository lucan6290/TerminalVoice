/// Energy-based Voice Activity Detection.
///
/// This is a lightweight VAD that uses RMS energy to determine whether
/// speech is present in an audio frame. It is intended for hands-free
/// mode silence detection.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VadState {
    Speaking,
    Silence,
    SilenceTimeout,
}

#[derive(Debug, Clone, Copy)]
pub struct VadConfig {
    /// RMS energy below this value is considered silence.
    pub silence_threshold: f32,
    /// Milliseconds of continuous silence before triggering timeout.
    pub silence_duration_ms: u64,
    /// Frame duration in milliseconds (for counting silence duration).
    pub frame_duration_ms: u64,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            silence_threshold: 0.01,
            silence_duration_ms: 2000,
            frame_duration_ms: 20,
        }
    }
}

pub struct VoiceActivityDetector {
    config: VadConfig,
    silence_ms: u64,
    was_speaking: bool,
}

impl VoiceActivityDetector {
    pub fn new(config: VadConfig) -> Self {
        Self {
            config,
            silence_ms: 0,
            was_speaking: false,
        }
    }

    /// Process a frame of mono f32 samples and return the VAD state.
    pub fn process_frame(&mut self, samples: &[f32]) -> VadState {
        let rms = compute_rms(samples);
        if rms >= self.config.silence_threshold {
            self.silence_ms = 0;
            self.was_speaking = true;
            VadState::Speaking
        } else {
            self.silence_ms += self.config.frame_duration_ms;
            if self.silence_ms >= self.config.silence_duration_ms {
                VadState::SilenceTimeout
            } else {
                VadState::Silence
            }
        }
    }

    /// Reset the detector to its initial state.
    pub fn reset(&mut self) {
        self.silence_ms = 0;
        self.was_speaking = false;
    }

    /// Returns whether speech has been detected since the last reset.
    pub fn was_speaking(&self) -> bool {
        self.was_speaking
    }
}

fn compute_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f64 = samples.iter().map(|s| (*s as f64) * (*s as f64)).sum();
    (sum_sq / samples.len() as f64).sqrt() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> VadConfig {
        VadConfig {
            silence_threshold: 0.01,
            silence_duration_ms: 100,
            frame_duration_ms: 50,
        }
    }

    #[test]
    fn loud_audio_detected_as_speaking() {
        let mut vad = VoiceActivityDetector::new(config());
        let state = vad.process_frame(&[0.5, 0.5, 0.5, 0.5]);
        assert_eq!(state, VadState::Speaking);
        assert!(vad.was_speaking());
    }

    #[test]
    fn silent_audio_detected_as_silence() {
        let mut vad = VoiceActivityDetector::new(config());
        let state = vad.process_frame(&[0.0, 0.0, 0.0, 0.0]);
        assert_eq!(state, VadState::Silence);
        assert!(!vad.was_speaking());
    }

    #[test]
    fn sustained_silence_triggers_timeout() {
        let mut vad = VoiceActivityDetector::new(config());
        // frame_duration_ms=50, silence_duration_ms=100
        // First silent frame: silence_ms=50 < 100 → Silence
        assert_eq!(vad.process_frame(&[0.0; 4]), VadState::Silence);
        // Second silent frame: silence_ms=100 >= 100 → SilenceTimeout
        assert_eq!(vad.process_frame(&[0.0; 4]), VadState::SilenceTimeout);
    }

    #[test]
    fn speech_resets_silence_counter() {
        let mut vad = VoiceActivityDetector::new(config());
        vad.process_frame(&[0.0; 4]); // silence_ms=50
        vad.process_frame(&[0.5; 4]); // speaking, silence_ms reset to 0
        assert_eq!(vad.process_frame(&[0.0; 4]), VadState::Silence); // silence_ms=50
    }

    #[test]
    fn reset_clears_state() {
        let mut vad = VoiceActivityDetector::new(config());
        vad.process_frame(&[0.5; 4]);
        assert!(vad.was_speaking());
        vad.reset();
        assert!(!vad.was_speaking());
        assert_eq!(vad.process_frame(&[0.0; 4]), VadState::Silence);
    }

    #[test]
    fn empty_frame_is_silent() {
        let mut vad = VoiceActivityDetector::new(config());
        assert_eq!(vad.process_frame(&[]), VadState::Silence);
    }
}
