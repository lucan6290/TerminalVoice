use rdev::{EventType, Key};

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

/// 热键配置：PTT / TTS / 翻译三个可自定义按键。
///
/// 配置格式（在 DB 中以字符串存储）：
/// - `"RightAlt"` / `"LeftAlt"` / `"Alt"` / `"Control"` / `"Shift"` / `"F1"~"F12"` 等单键
/// - 组合键暂不支持（TTS/翻译本身就是 Alt+数字的"修饰键+主键"范式，这里把主键单独配）
///
/// Esc 永远作为取消键，Shift+PTT 永远作为改写模式（不可配置）。
#[derive(Debug, Clone)]
pub struct HotkeyConfig {
    /// PTT 按键（按住说话），默认 RightAlt
    pub ptt: Key,
    /// 是否需要 Alt 作为修饰键触发 TTS/翻译（true = Alt+tts_key，false = 单独按 tts_key）
    pub tts: Key,
    pub translate: Key,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            ptt: Key::AltGr,
            tts: Key::Num1,
            translate: Key::Num2,
        }
    }
}

/// 把字符串按键名解析为 rdev::Key。
pub fn parse_hotkey(s: &str) -> Option<Key> {
    match s.trim().to_ascii_lowercase().as_str() {
        // Alt 变体
        "rightalt" | "right-alt" | "altgr" | "ralt" => Some(Key::AltGr),
        "leftalt" | "left-alt" | "lalt" => Some(Key::Alt),
        "alt" => Some(Key::AltGr), // 默认 Alt 指右 Alt（保持原默认行为）
        // Ctrl
        "rightctrl" | "right-ctrl" | "rctrl" => Some(Key::ControlRight),
        "leftctrl" | "left-ctrl" | "lctrl" | "ctrl" | "control" => Some(Key::ControlLeft),
        // Shift
        "rightshift" | "right-shift" | "rshift" => Some(Key::ShiftRight),
        "leftshift" | "left-shift" | "lshift" | "shift" => Some(Key::ShiftLeft),
        // 主键区
        "space" => Some(Key::Space),
        "enter" | "return" => Some(Key::Return),
        "tab" => Some(Key::Tab),
        "escape" | "esc" => Some(Key::Escape),
        "backspace" => Some(Key::Backspace),
        // 数字键（主键区）
        "0" | "num0" => Some(Key::Num0),
        "1" | "num1" => Some(Key::Num1),
        "2" | "num2" => Some(Key::Num2),
        "3" | "num3" => Some(Key::Num3),
        "4" | "num4" => Some(Key::Num4),
        "5" | "num5" => Some(Key::Num5),
        "6" | "num6" => Some(Key::Num6),
        "7" | "num7" => Some(Key::Num7),
        "8" | "num8" => Some(Key::Num8),
        "9" | "num9" => Some(Key::Num9),
        // F 键
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),
        // 字母
        "a" => Some(Key::KeyA),
        "b" => Some(Key::KeyB),
        "c" => Some(Key::KeyC),
        "d" => Some(Key::KeyD),
        "e" => Some(Key::KeyE),
        "f" => Some(Key::KeyF),
        "g" => Some(Key::KeyG),
        "h" => Some(Key::KeyH),
        "i" => Some(Key::KeyI),
        "j" => Some(Key::KeyJ),
        "k" => Some(Key::KeyK),
        "l" => Some(Key::KeyL),
        "m" => Some(Key::KeyM),
        "n" => Some(Key::KeyN),
        "o" => Some(Key::KeyO),
        "p" => Some(Key::KeyP),
        "q" => Some(Key::KeyQ),
        "r" => Some(Key::KeyR),
        "s" => Some(Key::KeyS),
        "t" => Some(Key::KeyT),
        "u" => Some(Key::KeyU),
        "v" => Some(Key::KeyV),
        "w" => Some(Key::KeyW),
        "x" => Some(Key::KeyX),
        "y" => Some(Key::KeyY),
        "z" => Some(Key::KeyZ),
        // 其它按键可按需扩展
        _ => None,
    }
}

/// 把 rdev::Key 格式化为用户可读字符串（与 parse_hotkey 对称）。
pub fn format_hotkey(key: Key) -> String {
    match key {
        Key::AltGr => "Right-Alt".to_string(),
        Key::Alt => "Alt".to_string(),
        Key::ControlLeft => "Ctrl".to_string(),
        Key::ControlRight => "Right-Ctrl".to_string(),
        Key::ShiftLeft => "Shift".to_string(),
        Key::ShiftRight => "Right-Shift".to_string(),
        Key::Space => "Space".to_string(),
        Key::Return => "Enter".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Escape => "Esc".to_string(),
        Key::Backspace => "Backspace".to_string(),
        Key::Num0 => "0".to_string(),
        Key::Num1 => "1".to_string(),
        Key::Num2 => "2".to_string(),
        Key::Num3 => "3".to_string(),
        Key::Num4 => "4".to_string(),
        Key::Num5 => "5".to_string(),
        Key::Num6 => "6".to_string(),
        Key::Num7 => "7".to_string(),
        Key::Num8 => "8".to_string(),
        Key::Num9 => "9".to_string(),
        Key::F1 => "F1".to_string(),
        Key::F2 => "F2".to_string(),
        Key::F3 => "F3".to_string(),
        Key::F4 => "F4".to_string(),
        Key::F5 => "F5".to_string(),
        Key::F6 => "F6".to_string(),
        Key::F7 => "F7".to_string(),
        Key::F8 => "F8".to_string(),
        Key::F9 => "F9".to_string(),
        Key::F10 => "F10".to_string(),
        Key::F11 => "F11".to_string(),
        Key::F12 => "F12".to_string(),
        Key::KeyA => "A".to_string(),
        Key::KeyB => "B".to_string(),
        Key::KeyC => "C".to_string(),
        Key::KeyD => "D".to_string(),
        Key::KeyE => "E".to_string(),
        Key::KeyF => "F".to_string(),
        Key::KeyG => "G".to_string(),
        Key::KeyH => "H".to_string(),
        Key::KeyI => "I".to_string(),
        Key::KeyJ => "J".to_string(),
        Key::KeyK => "K".to_string(),
        Key::KeyL => "L".to_string(),
        Key::KeyM => "M".to_string(),
        Key::KeyN => "N".to_string(),
        Key::KeyO => "O".to_string(),
        Key::KeyP => "P".to_string(),
        Key::KeyQ => "Q".to_string(),
        Key::KeyR => "R".to_string(),
        Key::KeyS => "S".to_string(),
        Key::KeyT => "T".to_string(),
        Key::KeyU => "U".to_string(),
        Key::KeyV => "V".to_string(),
        Key::KeyW => "W".to_string(),
        Key::KeyX => "X".to_string(),
        Key::KeyY => "Y".to_string(),
        Key::KeyZ => "Z".to_string(),
        other => format!("{:?}", other),
    }
}

#[derive(Debug)]
pub struct HotkeyEdgeState {
    pressed: bool,
    shift_held: bool,
    rewrite_mode: bool,
    alt_held: bool,
    config: HotkeyConfig,
}

impl HotkeyEdgeState {
    pub fn new(config: HotkeyConfig) -> Self {
        Self {
            pressed: false,
            shift_held: false,
            rewrite_mode: false,
            alt_held: false,
            config,
        }
    }

    /// 运行时替换 config（保留按下/修饰键状态）。
    pub fn replace_config(&mut self, config: HotkeyConfig) {
        self.config = config;
    }

    pub fn handle(&mut self, event: &EventType) -> Option<HotkeyEvent> {
        match event {
            // Shift 键跟踪（用于改写模式：Shift + PTT）
            EventType::KeyPress(Key::ShiftLeft) | EventType::KeyPress(Key::ShiftRight) => {
                self.shift_held = true;
                None
            }
            EventType::KeyRelease(Key::ShiftLeft) | EventType::KeyRelease(Key::ShiftRight) => {
                self.shift_held = false;
                None
            }
            // 任意 Alt 键跟踪（用于 Alt + 数字 触发 TTS/翻译）
            EventType::KeyPress(Key::Alt) | EventType::KeyPress(Key::AltGr) => {
                self.alt_held = true;
                // 如果是 PTT 键本身，按下 PTT
                let key = match event {
                    EventType::KeyPress(k) => *k,
                    _ => unreachable!(),
                };
                if key == self.config.ptt && !self.pressed && !self.rewrite_mode {
                    if self.shift_held {
                        self.rewrite_mode = true;
                        Some(HotkeyEvent::RewritePressed)
                    } else {
                        self.pressed = true;
                        Some(HotkeyEvent::Pressed)
                    }
                } else {
                    None
                }
            }
            EventType::KeyRelease(k) if is_alt_key(*k) => {
                self.alt_held = false;
                // 如果释放的是 PTT 键
                if *k == self.config.ptt {
                    if self.pressed {
                        self.pressed = false;
                        return Some(HotkeyEvent::Released);
                    }
                    if self.rewrite_mode {
                        self.rewrite_mode = false;
                        return Some(HotkeyEvent::RewriteReleased);
                    }
                }
                None
            }
            // PTT 键（可能是 Ctrl/Fx 等非 Alt 键）：独立处理按下
            EventType::KeyPress(k) if !is_alt_key(*k) && *k == self.config.ptt => {
                if self.pressed || self.rewrite_mode {
                    return None;
                }
                if self.shift_held {
                    self.rewrite_mode = true;
                    Some(HotkeyEvent::RewritePressed)
                } else {
                    self.pressed = true;
                    Some(HotkeyEvent::Pressed)
                }
            }
            EventType::KeyRelease(k) if !is_alt_key(*k) && *k == self.config.ptt => {
                if self.pressed {
                    self.pressed = false;
                    Some(HotkeyEvent::Released)
                } else if self.rewrite_mode {
                    self.rewrite_mode = false;
                    Some(HotkeyEvent::RewriteReleased)
                } else {
                    None
                }
            }
            // TTS：Alt(非PTT) + tts 键
            EventType::KeyPress(k)
                if *k == self.config.tts && self.alt_held =>
            {
                Some(HotkeyEvent::TtsToggle)
            }
            // Translate：Alt(非PTT) + translate 键
            EventType::KeyPress(k)
                if *k == self.config.translate && self.alt_held =>
            {
                Some(HotkeyEvent::Translate)
            }
            // Esc：取消
            EventType::KeyPress(Key::Escape) => Some(HotkeyEvent::Cancelled),
            _ => None,
        }
    }
}

fn is_alt_key(key: Key) -> bool {
    matches!(key, Key::Alt | Key::AltGr)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_event(key: Key, press: bool) -> EventType {
        if press { EventType::KeyPress(key) } else { EventType::KeyRelease(key) }
    }

    #[test]
    fn default_config_altgr_works() {
        let mut state = HotkeyEdgeState::new(HotkeyConfig::default());
        assert_eq!(state.handle(&make_event(Key::AltGr, true)), Some(HotkeyEvent::Pressed));
        assert_eq!(state.handle(&make_event(Key::AltGr, true)), None);
        assert_eq!(state.handle(&make_event(Key::AltGr, false)), Some(HotkeyEvent::Released));
    }

    #[test]
    fn ptt_can_be_fkey() {
        let mut state = HotkeyEdgeState::new(HotkeyConfig {
            ptt: Key::F6,
            tts: Key::Num1,
            translate: Key::Num2,
        });
        assert_eq!(state.handle(&make_event(Key::F6, true)), Some(HotkeyEvent::Pressed));
        assert_eq!(state.handle(&make_event(Key::F6, false)), Some(HotkeyEvent::Released));
    }

    #[test]
    fn tts_requires_alt_modifier() {
        let mut state = HotkeyEdgeState::new(HotkeyConfig::default());
        // 没按 Alt 时按 1 不触发
        assert_eq!(state.handle(&make_event(Key::Num1, true)), None);
        // 按下 Alt（但不是 PTT 那个 Alt —— 左 Alt）
        assert_eq!(state.handle(&make_event(Key::Alt, true)), None);
        // 再按 1 → TTS
        assert_eq!(state.handle(&make_event(Key::Num1, true)), Some(HotkeyEvent::TtsToggle));
    }

    #[test]
    fn parse_and_format_roundtrip() {
        for (name, key) in [
            ("RightAlt", Key::AltGr),
            ("Ctrl", Key::ControlLeft),
            ("F6", Key::F6),
            ("Space", Key::Space),
            ("Esc", Key::Escape),
        ] {
            assert_eq!(parse_hotkey(name), Some(key));
            assert_eq!(format_hotkey(key).to_ascii_lowercase().replace("-", "").replace(" ", ""), name.to_ascii_lowercase());
        }
    }
}
