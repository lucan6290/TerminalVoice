use rubato::{FftFixedIn, Resampler};

pub const TARGET_SAMPLE_RATE: u32 = 16_000;

/// 将浮点采样裁剪到 [-1, 1] 并编码为单声道 16-bit PCM WAV。
pub fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::new(&mut cursor, spec)
        .map_err(|error| format!("failed to create WAV writer: {error}"))?;
    for &sample in samples {
        writer
            .write_sample(float_to_i16(sample))
            .map_err(|error| format!("failed to write WAV sample: {error}"))?;
    }
    writer
        .finalize()
        .map_err(|error| format!("failed to finalize WAV: {error}"))?;
    Ok(cursor.into_inner())
}

pub fn float_to_i16(sample: f32) -> i16 {
    let normalized = sample.clamp(-1.0, 1.0);
    (normalized * i16::MAX as f32).round() as i16
}

/// 使用 rubato FFT resampler 将单声道音频转换为 16 kHz。
pub fn resample_to_16k(samples: &[f32], input_rate: u32) -> Result<Vec<f32>, String> {
    if samples.is_empty() || input_rate == TARGET_SAMPLE_RATE {
        return Ok(samples.to_vec());
    }
    if input_rate == 0 {
        return Err("input sample rate must be greater than zero".to_string());
    }

    let mut resampler =
        FftFixedIn::<f64>::new(input_rate as usize, TARGET_SAMPLE_RATE as usize, 1024, 2, 1)
            .map_err(|error| format!("failed to create resampler: {error}"))?;
    let input = samples
        .iter()
        .map(|&value| value as f64)
        .collect::<Vec<_>>();
    let mut output = Vec::with_capacity(
        (samples.len() as f64 * TARGET_SAMPLE_RATE as f64 / input_rate as f64).ceil() as usize,
    );
    let mut next = resampler.input_frames_next();
    let mut offset = 0;
    let mut buffer = vec![vec![0.0_f64; resampler.output_frames_max()]];

    while input.len() - offset >= next {
        let chunk = vec![&input[offset..offset + next]];
        let (_, produced) = resampler
            .process_into_buffer(&chunk, &mut buffer, None)
            .map_err(|error| format!("failed to resample audio: {error}"))?;
        output.extend_from_slice(&buffer[0][..produced]);
        offset += next;
        next = resampler.input_frames_next();
    }

    if offset < input.len() {
        let chunk = vec![&input[offset..]];
        let (_, produced) = resampler
            .process_partial_into_buffer(Some(&chunk), &mut buffer, None)
            .map_err(|error| format!("failed to resample final audio chunk: {error}"))?;
        output.extend_from_slice(&buffer[0][..produced]);
    }
    let expected = (samples.len() as u64 * TARGET_SAMPLE_RATE as u64 / input_rate as u64) as usize;
    output.truncate(expected);
    if output.len() < expected {
        let fill = output.last().copied().unwrap_or_default();
        output.resize(expected, fill);
    }
    Ok(output.into_iter().map(|sample| sample as f32).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_valid_wav_header() {
        let wav = encode_wav(&[0.0, 0.5, -0.5], TARGET_SAMPLE_RATE).expect("WAV encodes");
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[12..16], b"fmt ");
        assert_eq!(&wav[36..40], b"data");
        assert_eq!(wav.len(), 50);
    }

    #[test]
    fn clamps_float_samples_to_i16_range() {
        assert_eq!(float_to_i16(2.0), i16::MAX);
        assert_eq!(float_to_i16(-2.0), -i16::MAX);
        assert_eq!(float_to_i16(0.5), 16_384);
    }

    #[test]
    fn resamples_to_target_rate() {
        let input = vec![0.0_f32; 48_000];
        let output = resample_to_16k(&input, 48_000).expect("resamples");
        assert_eq!(output.len(), 16_000);
    }

    #[test]
    fn resamples_non_integer_ratio_to_target_rate() {
        let input = vec![0.0_f32; 44_100];
        let output = resample_to_16k(&input, 44_100).expect("resamples");
        assert_eq!(output.len(), 16_000);
    }
}
