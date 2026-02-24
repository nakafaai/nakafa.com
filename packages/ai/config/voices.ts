/**
 * ElevenLabs voice settings
 * Matches AI SDK providerOptions.elevenlabs.voiceSettings structure
 * @see https://sdk.vercel.ai/providers/ai-sdk-providers/elevenlabs
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */
interface VoiceSettings {
  /**
   * Determines how closely the AI should adhere to the original voice
   * when attempting to replicate it.
   * Range: 0.0 to 1.0
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  similarityBoost?: number;
  /**
   * Determines how stable the voice is and the randomness between each generation.
   * For ElevenLabs V3: 0.0 (Creative), 0.5 (Natural), or 1.0 (Robust).
   * Range: 0.0 to 1.0
   * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
   */
  stability?: number;

  /**
   * Determines the style exaggeration of the voice.
   * This setting attempts to amplify the style of the original speaker.
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
interface VoiceConfig {
  /**
   * Optional description of the voice characteristics.
   */
  description?: string;
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
}

/**
 * ElevenLabs V3 Settings Guide for MAXIMUM EMOTION & HUMAN-LIKE DELIVERY:
 *
 * Based on https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 *
 * - stability: 0.0 (Creative mode)
 *   Docs: "Creative: More emotional and expressive, but prone to hallucinations."
 *   Docs: "For maximum expressiveness with audio tags, use Creative or Natural settings"
 *   MUST be exactly 0.0, 0.5, or 1.0 for V3
 *
 * - similarityBoost: 0.75
 *   HIGHER value = maintains voice consistency while allowing emotional range
 *   Too low (0.40) = unstable, robotic voice
 *   Too high = "stuck" to training samples
 *   0.75 is sweet spot for natural + emotional
 *
 * - style: 0.80
 *   MAXIMUM expressiveness for educational content
 *   Docs: "Style exaggeration amplifies the original speaker's style"
 *   Higher = more emotional delivery
 *
 * - useSpeakerBoost: true
 *   Improves voice quality and naturalness
 *   Docs recommended for better output quality
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
const PREDEFINED_VOICES = {
  nina: {
    id: "LcvlyuBGMjj1h4uAtQjo",
    name: "Nina",
    description:
      "A warm, dynamic, mature female voice optimized for maximum emotional delivery in educational content.",
    settings: {
      stability: 0.0, // Creative: Maximum expressiveness (docs: "More emotional and expressive")
      similarityBoost: 0.75, // Higher for consistent voice quality while allowing emotion
      style: 0.8, // Maximum expressiveness (docs: "amplifies the original speaker's style")
      useSpeakerBoost: true, // Enhances voice naturalness and quality
    },
  },
} as const satisfies Record<string, VoiceConfig>;

/**
 * Available voice keys from predefined voices.
 */
type VoiceKey = keyof typeof PREDEFINED_VOICES;

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
 * Get the default voice settings.
 * Used as fallback when no custom settings are provided.
 * @returns The default VoiceSettings object
 */
export function getDefaultVoiceSettings(): VoiceSettings {
  return PREDEFINED_VOICES[DEFAULT_VOICE_KEY].settings;
}
