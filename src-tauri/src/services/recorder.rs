use crate::services::audio::{resample_to_16k, TARGET_SAMPLE_RATE};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const MIN_RECORDING_DURATION: Duration = Duration::from_millis(300);
pub const MAX_RECORDING_DURATION: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, PartialEq)]
pub struct AudioBuffer {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub duration: Duration,
}

impl AudioBuffer {
    pub fn is_valid(&self) -> bool {
        self.duration >= MIN_RECORDING_DURATION && !self.samples.is_empty()
    }
}

pub struct Recorder {
    stream: Option<Stream>,
    samples: Arc<Mutex<Vec<f32>>>,
    started_at: Option<Instant>,
    sample_rate: u32,
    error: Arc<Mutex<Option<String>>>,
}

impl Default for Recorder {
    fn default() -> Self {
        Self::new()
    }
}

impl Recorder {
    pub fn new() -> Self {
        Self {
            stream: None,
            samples: Arc::new(Mutex::new(Vec::new())),
            started_at: None,
            sample_rate: TARGET_SAMPLE_RATE,
            error: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.stream.is_some()
    }

    pub fn start(&mut self, device_name: Option<&str>) -> Result<(), String> {
        if self.is_recording() {
            return Err("录音已经在进行中".to_string());
        }

        let host = cpal::default_host();
        let device = match device_name {
            Some(name) if !name.is_empty() && name != "default" => host
                .input_devices()
                .map_err(|error| format!("无法枚举麦克风设备: {error}"))?
                .find(|device| device.name().map(|value| value == name).unwrap_or(false))
                .ok_or_else(|| format!("未找到麦克风设备: {name}"))?,
            _ => host
                .default_input_device()
                .ok_or_else(|| "未检测到麦克风设备".to_string())?,
        };
        let supported = device
            .default_input_config()
            .map_err(|error| format!("无法读取麦克风配置: {error}"))?;
        let sample_format = supported.sample_format();
        let config: StreamConfig = supported.clone().into();
        let channels = config.channels;
        let sample_rate = config.sample_rate.0;
        let samples = Arc::clone(&self.samples);
        let error_slot = Arc::clone(&self.error);
        if let Ok(mut values) = self.samples.lock() {
            values.clear();
        }
        if let Ok(mut error) = self.error.lock() {
            *error = None;
        }

        let err_fn = move |error: cpal::StreamError| {
            if let Ok(mut slot) = error_slot.lock() {
                *slot = Some(error.to_string());
            }
        };
        let stream = match sample_format {
            SampleFormat::I8 => {
                build_stream::<i8, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::I16 => {
                build_stream::<i16, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::I32 => {
                build_stream::<i32, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::I64 => {
                build_stream::<i64, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::U8 => {
                build_stream::<u8, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::U16 => {
                build_stream::<u16, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::U32 => {
                build_stream::<u32, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::U64 => {
                build_stream::<u64, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::F32 => {
                build_stream::<f32, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            SampleFormat::F64 => {
                build_stream::<f64, _>(&device, &config, channels, samples.clone(), err_fn)?
            }
            unsupported => return Err(format!("不支持的麦克风采样格式: {unsupported}")),
        };
        stream
            .play()
            .map_err(|error| format!("无法启动麦克风录音: {error}"))?;
        self.stream = Some(stream);
        self.started_at = Some(Instant::now());
        self.sample_rate = sample_rate;
        Ok(())
    }

    pub fn stop(&mut self) -> Result<AudioBuffer, String> {
        let started_at = self
            .started_at
            .take()
            .ok_or_else(|| "当前没有正在进行的录音".to_string())?;
        self.stream.take();
        let duration = started_at.elapsed().min(MAX_RECORDING_DURATION);
        if let Some(error) = self
            .error
            .lock()
            .map_err(|error| error.to_string())?
            .clone()
        {
            return Err(format!("麦克风录音失败: {error}"));
        }
        let mono = self
            .samples
            .lock()
            .map_err(|error| error.to_string())?
            .clone();
        let samples = resample_to_16k(&mono, self.sample_rate)?;
        Ok(AudioBuffer {
            samples,
            sample_rate: TARGET_SAMPLE_RATE,
            duration,
        })
    }

    pub fn cancel(&mut self) {
        self.started_at = None;
        self.stream.take();
        if let Ok(mut samples) = self.samples.lock() {
            samples.clear();
        }
    }

    pub fn elapsed(&self) -> Option<Duration> {
        self.started_at.map(|started| started.elapsed())
    }
}

fn build_stream<T, E>(
    device: &cpal::Device,
    config: &StreamConfig,
    channels: u16,
    samples: Arc<Mutex<Vec<f32>>>,
    error_callback: E,
) -> Result<Stream, String>
where
    T: cpal::SizedSample + SampleToF32 + Copy,
    E: FnMut(cpal::StreamError) + Send + 'static,
{
    device
        .build_input_stream(
            config,
            move |data: &[T], _| append_interleaved(data, channels as usize, &samples),
            error_callback,
            None,
        )
        .map_err(|error| format!("无法创建麦克风输入流: {error}"))
}

trait SampleToF32 {
    fn to_f32(self) -> f32;
}

macro_rules! impl_signed {
    ($($ty:ty),*) => {
        $(impl SampleToF32 for $ty {
            fn to_f32(self) -> f32 { self as f32 / <$ty>::MAX as f32 }
        })*
    };
}
macro_rules! impl_unsigned {
    ($($ty:ty),*) => {
        $(impl SampleToF32 for $ty {
            fn to_f32(self) -> f32 { (self as f32 / <$ty>::MAX as f32) * 2.0 - 1.0 }
        })*
    };
}
impl_signed!(i8, i16, i32, i64);
impl_unsigned!(u8, u16, u32, u64);
impl SampleToF32 for f32 {
    fn to_f32(self) -> f32 {
        self
    }
}
impl SampleToF32 for f64 {
    fn to_f32(self) -> f32 {
        self as f32
    }
}

fn append_interleaved<T: SampleToF32 + Copy>(
    data: &[T],
    channels: usize,
    output: &Arc<Mutex<Vec<f32>>>,
) {
    if channels == 0 {
        return;
    }
    if let Ok(mut samples) = output.lock() {
        for frame in data.chunks(channels) {
            let sum: f32 = frame.iter().map(|sample| (*sample).to_f32()).sum();
            samples.push(sum / frame.len() as f32);
        }
    }
}

pub fn downmix_to_mono(interleaved: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }
    interleaved
        .chunks(channels)
        .map(|frame| frame.iter().copied().sum::<f32>() / frame.len() as f32)
        .collect()
}

pub fn list_input_devices() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    let devices = host
        .input_devices()
        .map_err(|error| format!("无法枚举麦克风设备: {error}"))?;
    Ok(devices.filter_map(|device| device.name().ok()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_release_under_minimum_duration() {
        let buffer = AudioBuffer {
            samples: vec![0.0; 16],
            sample_rate: 16_000,
            duration: MIN_RECORDING_DURATION - Duration::from_millis(1),
        };
        assert!(!buffer.is_valid());
    }

    #[test]
    fn accepts_release_at_minimum_duration() {
        let buffer = AudioBuffer {
            samples: vec![0.0; 16],
            sample_rate: 16_000,
            duration: MIN_RECORDING_DURATION,
        };
        assert!(buffer.is_valid());
    }

    #[test]
    fn downmixes_interleaved_samples() {
        assert_eq!(downmix_to_mono(&[1.0, -1.0, 0.5, 0.5], 2), vec![0.0, 0.5]);
    }
}
