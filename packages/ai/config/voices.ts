export interface VoiceConfig {
  id: string;
  name: string;
  description: string;
  settings: {
    stability: number;
    similarityBoost: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

/**
 * Currently only Nina voice (ElevenLabs free plan limitation)
 * Easy to add more voices when upgrading plan
 */
export const PREDEFINED_VOICES = {
  nina: {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Nina",
    description: "Clear and educational, perfect for learning",
    settings: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
  },
  // Future voices (add when upgrading to paid plan):
  // alex: { id: "AZnzlk1XvdvUeBnXmlld", name: "Alex", ... },
  // sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", ... },
  // david: { id: "MF3mGyEYCl7XYWbV9V6O", name: "David", ... },
  // maya: { id: "TxGEqnHWrfWFTfGW9XjX", name: "Maya", ... },
} as const satisfies Record<string, VoiceConfig>;

export type VoiceKey = keyof typeof PREDEFINED_VOICES;
export const DEFAULT_VOICE_KEY: VoiceKey = "nina";

export function getVoiceConfig(key: VoiceKey): VoiceConfig {
  return PREDEFINED_VOICES[key];
}

export function isValidVoiceKey(key: string): key is VoiceKey {
  return key in PREDEFINED_VOICES;
}
