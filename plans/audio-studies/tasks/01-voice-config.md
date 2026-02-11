# Task 0.1: Define Voice Configuration

## Goal
Create voice configuration with 5 predefined ElevenLabs voices.

## File
`packages/ai/config/voices.ts`

## Implementation

```typescript
/**
 * Predefined ElevenLabs voices for Audio Studies feature.
 * These are curated for educational content narration.
 */

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
  sampleStorageId?: string;
}

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
  alex: {
    id: "AZnzlk1XvdvUeBnXmlld",
    name: "Alex",
    description: "Energetic and engaging for exciting topics",
    settings: {
      stability: 0.4,
      similarityBoost: 0.8,
      style: 0.3,
    },
  },
  sarah: {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Calm and soothing for dense content",
    settings: {
      stability: 0.6,
      similarityBoost: 0.7,
    },
  },
  david: {
    id: "MF3mGyEYCl7XYWbV9V6O",
    name: "David",
    description: "Professional and authoritative for formal content",
    settings: {
      stability: 0.55,
      similarityBoost: 0.72,
    },
  },
  maya: {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Maya",
    description: "Friendly and conversational",
    settings: {
      stability: 0.45,
      similarityBoost: 0.78,
      style: 0.2,
    },
  },
} as const satisfies Record<string, VoiceConfig>;

export type VoiceKey = keyof typeof PREDEFINED_VOICES;

export const DEFAULT_VOICE_KEY: VoiceKey = "nina";

export function getVoiceConfig(key: VoiceKey): VoiceConfig {
  return PREDEFINED_VOICES[key];
}

export function isValidVoiceKey(key: string): key is VoiceKey {
  return key in PREDEFINED_VOICES;
}
```

## Commands
```bash
pnpm typecheck
```
