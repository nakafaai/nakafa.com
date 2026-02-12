import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { keys } from "@repo/ai/keys";

/**
 * ElevenLabs client instance.
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export const elevenlabs = createElevenLabs({
  apiKey: keys().ELEVENLABS_API_KEY,
});

/**
 * Available ElevenLabs speech models.
 * @see https://elevenlabs.io/docs/overview/models
 */
export type ElevenLabsModel =
  | "eleven_v3" // V3: Most emotional, 5k chars, 70+ languages (NO previous_text support yet)
  | "eleven_multilingual_v2" // V2: Most stable, 10k chars, 29 languages (SUPPORTS previous_text)
  | "eleven_flash_v2_5" // Flash: Fast, 40k chars, 32 languages
  | "eleven_turbo_v2_5"; // Turbo: Balanced, 40k chars, 32 languages

/**
 * Model configuration with limits and features.
 */
export interface ModelConfig {
  id: ElevenLabsModel;
  maxChars: number;
  supportsContext: boolean; // previous_text / next_text
  supportsRequestIds: boolean; // previous_request_ids
  description: string;
}

/**
 * Model configurations.
 * @see https://elevenlabs.io/docs/overview/models#character-limits
 */
export const MODEL_CONFIGS: Record<ElevenLabsModel, ModelConfig> = {
  eleven_v3: {
    id: "eleven_v3",
    maxChars: 5000,
    supportsContext: false, // Not yet supported as of Feb 2025
    supportsRequestIds: false,
    description:
      "Most emotional and expressive. 70+ languages. 5k char limit. Audio tags work best.",
  },
  eleven_multilingual_v2: {
    id: "eleven_multilingual_v2",
    maxChars: 10_000,
    supportsContext: true, // Supports previous_text / next_text
    supportsRequestIds: true,
    description:
      "Most stable for long-form. Rich emotional expression. 29 languages. 10k char limit.",
  },
  eleven_flash_v2_5: {
    id: "eleven_flash_v2_5",
    maxChars: 40_000,
    supportsContext: true,
    supportsRequestIds: true,
    description:
      "Ultra-fast (~75ms). 32 languages. 40k char limit. Best for real-time.",
  },
  eleven_turbo_v2_5: {
    id: "eleven_turbo_v2_5",
    maxChars: 40_000,
    supportsContext: true,
    supportsRequestIds: true,
    description: "Balanced quality and speed. 32 languages. 40k char limit.",
  },
};

/**
 * ACTIVE MODEL - Change this to switch models easily.
 *
 * Current recommendation: Use "eleven_multilingual_v2" for production
 * because it supports previous_text/next_text for chunk continuity.
 *
 * V3 is better for emotional range but doesn't support context parameters yet.
 */
export const ACTIVE_MODEL: ElevenLabsModel = "eleven_multilingual_v2";

/**
 * Get configuration for the active model.
 */
export function getActiveModelConfig(): ModelConfig {
  return MODEL_CONFIGS[ACTIVE_MODEL];
}

/**
 * Maximum characters per chunk for the active model.
 * Uses safety margin to ensure we never exceed the limit.
 */
export function getMaxCharsPerChunk(): number {
  const config = getActiveModelConfig();
  // Use 90% of max as safety margin for context overhead
  return Math.floor(config.maxChars * 0.9);
}

/**
 * @deprecated Use getMaxCharsPerChunk() instead
 */
export const V3_MAX_CHARS_PER_CHUNK = 4500;
