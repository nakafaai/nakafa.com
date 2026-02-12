/**
 * ElevenLabs voice settings
 * Matches AI SDK providerOptions.elevenlabs.voiceSettings structure
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/elevenlabs
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */
export interface VoiceSettings {
  /**
   * Determines how stable the voice is and the randomness between each generation.
   * For ElevenLabs V3: MUST be 0.0 (Creative), 0.5 (Natural), or 1.0 (Robust).
   * Use 0.0 for maximum expressiveness with audio tags.
   * Range: 0.0, 0.5, or 1.0 for V3. Any value 0.0-1.0 for V2.
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
 *
 * ElevenLabs V3 Settings Guide:
 * - stability: MUST be 0.0 (Creative), 0.5 (Natural), or 1.0 (Robust)
 *   For rich emotions with audio tags, use 0.0 (Creative)
 * - similarityBoost: 0.50-0.60 for natural variation
 * - style: 0.60-0.80 for expressiveness
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
export const PREDEFINED_VOICES = {
  nina: {
    id: "LcvlyuBGMjj1h4uAtQjo",
    name: "Nina",
    description:
      "A warm, dynamic, mature female voice with emotional delivery.",
    settings: {
      stability: 0.0, // Creative mode for maximum expressiveness with audio tags
      similarityBoost: 0.55,
      style: 0.65,
      useSpeakerBoost: true,
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
