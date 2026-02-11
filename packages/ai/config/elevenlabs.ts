import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { keys } from "@repo/ai/keys";

export const elevenlabs = createElevenLabs({
  apiKey: keys().ELEVENLABS_API_KEY,
});
