import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { keys } from "@repo/ai/keys";

/**
 * ElevenLabs client instance.
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
export const elevenlabs = createElevenLabs({
  apiKey: keys().ELEVENLABS_API_KEY,
});

/**
 * ElevenLabs V3 - Most expressive TTS model.
 * @see https://elevenlabs.io/docs/overview/models
 */
export const ACTIVE_MODEL = "eleven_v3";

/**
 * Maximum characters per request for V3.
 * V3 has a 5,000 character limit per request.
 * Using 4,800 as safety margin.
 */
export const V3_MAX_CHARS_PER_CHUNK = 4800;

/**
 * @deprecated Use V3_MAX_CHARS_PER_CHUNK directly
 */
export const getMaxCharsPerChunk = (): number => V3_MAX_CHARS_PER_CHUNK;
