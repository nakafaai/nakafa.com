import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { keys } from "@repo/ai/keys";

/**
 * ElevenLabs V3 - Most expressive TTS model.
 * @see https://elevenlabs.io/docs/overview/models
 */
export const ACTIVE_MODEL = "eleven_v3";

/**
 * Creates an ElevenLabs client after the caller enters speech generation.
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
export function createElevenLabsClient() {
  return createElevenLabs({
    apiKey: keys().ELEVENLABS_API_KEY,
  });
}
