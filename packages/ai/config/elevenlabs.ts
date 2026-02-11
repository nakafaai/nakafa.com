import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { keys } from "@repo/ai/keys";

/**
 * ElevenLabs API client configured with API key
 */
export const elevenlabs = new ElevenLabsClient({
  apiKey: keys().ELEVENLABS_API_KEY,
});
