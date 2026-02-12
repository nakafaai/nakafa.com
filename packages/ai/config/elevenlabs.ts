import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { keys } from "@repo/ai/keys";

/**
 * ElevenLabs client instance.
 * Uses V3 model for maximum emotional expressiveness with audio tags.
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export const elevenlabs = createElevenLabs({
  apiKey: keys().ELEVENLABS_API_KEY,
});

/**
 * Maximum characters per chunk for V3 model.
 * V3 has a 5,000 character limit per request.
 * We use 4,500 as a safety margin.
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export const V3_MAX_CHARS_PER_CHUNK = 4500;
