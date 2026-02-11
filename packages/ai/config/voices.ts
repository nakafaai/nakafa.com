/**
 * ElevenLabs voice settings
 * Matches AI SDK providerOptions.elevenlabs.voiceSettings structure
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/elevenlabs
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */
export interface VoiceSettings {
  /**
   * Determines how stable the voice is and the randomness between each generation.
   * Lower values introduce broader emotional range for the voice.
   * Higher values can result in a monotonous voice with limited emotion.
   * Range: 0.0 to 1.0
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  stability?: number;

  /**
   * Determines how closely the AI should adhere to the original voice
   * when attempting to replicate it.
   * Range: 0.0 to 1.0
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  similarityBoost?: number;

  /**
   * Determines the style exaggeration of the voice.
   * This setting attempts to amplify the style of the original speaker.
   * It does consume additional computational resources and might increase
   * latency if set to anything other than 0.
   * Range: 0.0 to 1.0
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  style?: number;

  /**
   * This setting boosts the similarity to the original speaker.
   * Using this setting requires a slightly higher computational load,
   * which in turn increases latency.
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  useSpeakerBoost?: boolean;

  /**
   * Adjusts the speed of the voice.
   * A value of 1.0 is the default speed, while values less than 1.0
   * slow down the speech, and values greater than 1.0 speed it up.
   * Range: 0.7 to 1.2
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  speed?: number;
}

/**
 * Configuration for a predefined ElevenLabs voice.
 */
export interface VoiceConfig {
  /**
   * The ElevenLabs voice ID.
   * @see https://elevenlabs.io/docs/voices/voice-library
   */
  id: string;

  /**
   * Display name for the voice.
   */
  name: string;

  /**
   * Voice-specific settings for this voice.
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  settings: VoiceSettings;

  /**
   * Optional description of the voice characteristics.
   */
  description?: string;
}

/**
 * Currently only Nina voice (ElevenLabs free plan limitation)
 * Easy to add more voices when upgrading plan
 */
export const PREDEFINED_VOICES = {
  nina: {
    id: "LcvlyuBGMjj1h4uAtQjo",
    name: "Nina",
    description:
      "A warm, dynamic, mature female voice with emotional delivery.",
    settings: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
  },
} as const satisfies Record<string, VoiceConfig>;

/**
 * Available voice keys from predefined voices.
 */
export type VoiceKey = keyof typeof PREDEFINED_VOICES;

/**
 * Default voice key for audio generation.
 */
export const DEFAULT_VOICE_KEY: VoiceKey = "nina";

/**
 * Get voice configuration by key.
 * @param key - The voice key (e.g., "nina")
 * @returns The voice configuration object
 */
export function getVoiceConfig(key: VoiceKey): VoiceConfig {
  return PREDEFINED_VOICES[key];
}

/**
 * Check if a string is a valid voice key.
 * @param key - The key to validate
 * @returns True if the key is a valid VoiceKey
 */
export function isValidVoiceKey(key: string): key is VoiceKey {
  return Object.hasOwn(PREDEFINED_VOICES, key);
}
