/**
 * Audio generation configuration constants.
 * Centralized configuration for cron jobs and rate limiting.
 *
 * Environment-based behavior:
 * - aggregatePopularity: Always runs (builds statistics for trending)
 * - processQueue: Only executes audio generation if ENABLE_AUDIO_GENERATION env var is set
 * - cleanup: Always runs (maintenance)
 *
 * To enable audio generation in production:
 * Set ENABLE_AUDIO_GENERATION=true in the Convex Dashboard deployment settings
 */

import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/**
 * Locales supported for audio generation.
 * This is the single source of truth for supported locales.
 * When adding new locales, update this array and the content will be
 * automatically generated for all locales.
 */
export const SUPPORTED_LOCALES: Locale[] = ["en", "id"];

/**
 * Default maximum content pieces to generate per day (across all locales).
 * Each content piece will be generated for ALL supported locales.
 *
 * Example: MAX_CONTENT_PER_DAY = 1, SUPPORTED_LOCALES = ["en", "id"]
 * Result: 1 content × 2 locales = 2 audio files per day
 *
 * Override via LIMIT_AUDIO_GENERATION_PER_DAY environment variable.
 */
export const DEFAULT_MAX_CONTENT_PER_DAY = 1;

/**
 * Maximum allowed content pieces per day (safety limit to prevent runaway costs).
 */
const MAX_CONTENT_PER_DAY_LIMIT = 10;

/**
 * Get the maximum content pieces to generate per day.
 * Reads from LIMIT_AUDIO_GENERATION_PER_DAY environment variable.
 * Falls back to DEFAULT_MAX_CONTENT_PER_DAY if not set or invalid.
 * Clamped between 1 and MAX_CONTENT_PER_DAY_LIMIT.
 *
 * @returns Validated max content per day (1-10)
 */
export function getMaxContentPerDay(): number {
  const envValue = process.env.LIMIT_AUDIO_GENERATION_PER_DAY;

  if (!envValue) {
    return DEFAULT_MAX_CONTENT_PER_DAY;
  }

  const parsed = Number.parseInt(envValue, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_MAX_CONTENT_PER_DAY;
  }

  // Clamp between 1 and MAX_CONTENT_PER_DAY_LIMIT
  return Math.max(1, Math.min(MAX_CONTENT_PER_DAY_LIMIT, parsed));
}

/** Minimum view threshold for queue eligibility */
export const MIN_VIEW_THRESHOLD = 10;

/** Retry configuration */
export const RETRY_CONFIG = {
  maxRetries: 3,
} as const;

/** Cleanup configuration */
export const CLEANUP_CONFIG = {
  retentionDays: 30,
} as const;

/**
 * Queue item timeout configuration.
 * Items stuck in "processing" state for longer than this are considered stale
 * and will be reset to "pending" for reprocessing.
 *
 * Default: 2 hours - accounts for:
 * - Script generation (fast, seconds)
 * - Speech generation (slow, can be minutes for long content)
 * - Network delays and retries
 * - Workflow step overhead
 */
export const QUEUE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check if audio generation is enabled for this deployment.
 * Set ENABLE_AUDIO_GENERATION=true in Convex Dashboard to enable.
 *
 * @returns true if audio generation should execute (ElevenLabs API calls)
 */
export function isAudioGenerationEnabled(): boolean {
  return process.env.ENABLE_AUDIO_GENERATION === "true";
}

/**
 * Regex for splitting text into words for word count estimation.
 * Used for calculating audio duration from script length.
 */
export const WORD_SPLIT_REGEX = /\s+/;

/**
 * Audio duration calculation constants.
 * Used for estimating audio duration from word count.
 */
export const WORDS_PER_MINUTE = 150; // Average speaking rate
export const SECONDS_PER_MINUTE = 60;

/**
 * PCM audio format constants for ElevenLabs API.
 * Using pcm_44100 (44.1kHz) for Pro plan - CD quality audio.
 *
 * ElevenLabs Output Formats:
 * - pcm_16000: 16kHz (default, lower quality, smaller file)
 * - pcm_22050: 22.05kHz (medium quality)
 * - pcm_44100: 44.1kHz (CD quality, Pro plan only)
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert#query-parameters
 * @see https://en.wikipedia.org/wiki/44,100_Hz
 */
export const PCM_FORMAT = {
  /** Output format: PCM 16-bit mono at 44.1kHz (CD quality) */
  outputFormat: "pcm_44100" as const,
  /** Sample rate in Hz (44.1kHz = CD quality) */
  sampleRate: 44_100,
  /** Bits per sample (16-bit = 2 bytes) */
  bitsPerSample: 16,
  /** Bytes per sample (16-bit mono = 2 bytes) */
  bytesPerSample: 2,
  /** Number of channels (mono = 1) */
  channels: 1,
};

/**
 * Calculate exact audio duration from PCM buffer size.
 * Returns duration in milliseconds as integer for maximum precision.
 *
 * WHY THIS IS 100% ACCURATE:
 * PCM (Pulse-Code Modulation) is uncompressed raw audio. Unlike MP3 which uses
 * lossy compression with variable bitrate (VBR), PCM stores every sample exactly.
 *
 * Mathematical Proof:
 * - Sample rate: 44,100 samples per second
 * - Bit depth: 16 bits per sample (2 bytes)
 * - Channels: 1 (mono)
 * - Bytes per second = 44,100 × 2 × 1 = 88,200 bytes/second
 * - Duration = Total Bytes / Bytes Per Second
 *
 * Example: 6:58.723 (418,723 ms) of audio
 * - Total bytes = 418.723 × 88,200 = 36,931,405 bytes
 * - Duration = 36,931,405 / 88,200 = 418.723 seconds = 418,723 ms ✓
 *
 * @param pcmBufferLength - Length of PCM buffer in bytes
 * @returns Duration in milliseconds (integer, maximum precision)
 * @see https://en.wikipedia.org/wiki/Pulse-code_modulation
 * @see https://en.wikipedia.org/wiki/Sampling_(signal_processing)#Sampling_rate
 */
export function calculateDurationFromPCM(pcmBufferLength: number): number {
  const samples = pcmBufferLength / PCM_FORMAT.bytesPerSample;
  const seconds = samples / PCM_FORMAT.sampleRate;
  return Math.round(seconds * 1000); // Convert to milliseconds
}

/**
 * Convert PCM buffer to WAV buffer with proper headers.
 *
 * WHY WAV INSTEAD OF MP3:
 *
 * 1. ACCURATE DURATION METADATA
 *    - WAV: Duration stored in header as exact byte count (100% accurate)
 *    - MP3: Duration can be inaccurate, especially with VBR (Variable Bit Rate)
 *    - Reference: https://en.wikipedia.org/wiki/WAV#File_format
 *
 * 2. NO CONCATENATION ISSUES
 *    - MP3: Each chunk has its own metadata header. Concatenating raw MP3 bytes
 *           keeps only the first chunk's duration header, causing incorrect duration.
 *    - WAV: We create a single WAV file with one header for the entire audio,
 *           so duration is always correct.
 *    - Reference: https://en.wikipedia.org/wiki/MP3#File_structure
 *
 * 3. LOSSLESS QUALITY
 *    - WAV: Uncompressed, no quality loss (exact PCM data + header)
 *    - MP3: Lossy compression, quality degradation
 *    - Reference: https://en.wikipedia.org/wiki/Lossless_compression
 *
 * 4. UNIVERSAL BROWSER SUPPORT
 *    - WAV supported by all browsers natively
 *    - Reference: https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers
 *
 * FORMAT COMPARISON:
 * ┌──────────┬───────────────┬───────────────┬──────────────────┐
 * │ Format   │ Compression   │ Duration Acc. │ Concatenation    │
 * ├──────────┼───────────────┼───────────────┼──────────────────┤
 * │ WAV      │ None          │ 100%          │ Safe             │
 * │ PCM      │ None          │ 100%          │ Safe (no header) │
 * │ MP3 CBR  │ Lossy         │ ~95%          │ Problematic      │
 * │ MP3 VBR  │ Lossy         │ ~70%          │ Very problematic │
 * └──────────┴───────────────┴───────────────┴──────────────────┘
 *
 * @param pcmBuffer - Raw PCM 16-bit 44.1kHz mono data
 * @returns WAV buffer with RIFF headers (44 bytes header + PCM data)
 * @see https://en.wikipedia.org/wiki/WAV
 * @see https://docs.fileformat.com/audio/wav/
 */
export function pcmToWav(pcmBuffer: Uint8Array): Uint8Array {
  const wavBuffer = new Uint8Array(44 + pcmBuffer.length);
  const view = new DataView(wavBuffer.buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBuffer.length, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, PCM_FORMAT.channels, true); // NumChannels
  view.setUint32(24, PCM_FORMAT.sampleRate, true); // SampleRate
  view.setUint32(28, PCM_FORMAT.sampleRate * PCM_FORMAT.bytesPerSample, true); // ByteRate
  view.setUint16(32, PCM_FORMAT.bytesPerSample, true); // BlockAlign
  view.setUint16(34, PCM_FORMAT.bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, pcmBuffer.length, true);

  // Copy PCM data
  wavBuffer.set(pcmBuffer, 44);

  return wavBuffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
