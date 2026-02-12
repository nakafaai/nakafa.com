/**
 * ElevenLabs V3 voice settings
 * V3 ONLY supports 'stability' parameter. All other settings cause 400 errors.
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export interface VoiceSettings {
  /**
   * Determines how stable the voice is and the randomness between each generation.
   * For ElevenLabs V3: MUST be 0.0 (Creative), 0.5 (Natural), or 1.0 (Robust).
   * Use 0.0 for maximum expressiveness with audio tags.
   * Range: 0.0, 0.5, or 1.0 only for V3.
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  stability?: number;
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
 * V3 Model Configuration
 * V3 ONLY supports 'stability' parameter (0.0, 0.5, or 1.0)
 * All other settings cause 400 Bad Request errors
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export const PREDEFINED_VOICES = {
  nina: {
    id: "LcvlyuBGMjj1h4uAtQjo",
    name: "Nina",
    description:
      "A warm, dynamic, mature female voice optimized for V3 with audio tags.",
    settings: {
      stability: 0.0,
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

/**
 * Get the default voice settings.
 * Used as fallback when no custom settings are provided.
 * @returns The default VoiceSettings object
 */
export function getDefaultVoiceSettings(): VoiceSettings {
  return PREDEFINED_VOICES[DEFAULT_VOICE_KEY].settings;
}

/**
 * Get the default voice ID.
 * @returns The default voice ID string
 */
export function getDefaultVoiceId(): string {
  return PREDEFINED_VOICES[DEFAULT_VOICE_KEY].id;
}
