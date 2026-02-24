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
