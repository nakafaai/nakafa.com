/** Default maximum completed audio content slugs per day. */
export const DEFAULT_MAX_AUDIO_CONTENT_PER_DAY = 1;

/** Hard cap for generated audio content slugs per day. */
export const MAX_AUDIO_CONTENT_PER_DAY_LIMIT = 10;

/** Popularity rows scanned per content type when filling the audio queue. */
export const MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE =
  MAX_AUDIO_CONTENT_PER_DAY_LIMIT * 20;

/** Minimum view count before content becomes eligible for audio generation. */
export const MIN_AUDIO_VIEW_THRESHOLD = 10;

/** Retry policy persisted with each audio queue row. */
export const AUDIO_RETRY_CONFIG = {
  maxRetries: 3,
} as const;

/** Retention policy for completed and failed audio queue rows. */
export const AUDIO_CLEANUP_CONFIG = {
  retentionDays: 30,
} as const;

/** Processing timeout after which queue rows can be retried. */
export const AUDIO_QUEUE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** PCM output format requested from the speech provider. */
export const PCM_FORMAT = {
  bitsPerSample: 16,
  bytesPerSample: 2,
  channels: 1,
  outputFormat: "pcm_44100",
  sampleRate: 44_100,
} as const;

/** Calculates audio duration in milliseconds from PCM byte length. */
export function calculateDurationFromPCM(pcmBufferLength: number) {
  const samples = pcmBufferLength / PCM_FORMAT.bytesPerSample;
  const seconds = samples / PCM_FORMAT.sampleRate;
  return Math.round(seconds * 1000);
}

/** Converts raw PCM bytes to a WAV byte buffer. */
export function pcmToWav(pcmBuffer: Uint8Array) {
  const wavBuffer = new Uint8Array(44 + pcmBuffer.length);
  const view = new DataView(wavBuffer.buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBuffer.length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, PCM_FORMAT.channels, true);
  view.setUint32(24, PCM_FORMAT.sampleRate, true);
  view.setUint32(28, PCM_FORMAT.sampleRate * PCM_FORMAT.bytesPerSample, true);
  view.setUint16(32, PCM_FORMAT.bytesPerSample, true);
  view.setUint16(34, PCM_FORMAT.bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcmBuffer.length, true);
  wavBuffer.set(pcmBuffer, 44);

  return wavBuffer;
}

/** Writes ASCII chunk labels into a binary WAV header. */
function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
