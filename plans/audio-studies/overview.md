# Audio Studies Feature Plan

## Overview

Enable Pro users to generate podcast-style audio studies from educational content (articles and subject sections) using ElevenLabs text-to-speech. Audio is cached per content+voice combination and shared across all users to minimize costs.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pro User      │────▶│  Request Audio   │────▶│  Check Cache    │
│   (UI)          │     │  (Mutation)      │     │  (Query)        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┼──────────────────┐
                              │                          │                  │
                              ▼                          ▼                  ▼
                    ┌─────────────────┐      ┌──────────────────┐  ┌──────────────┐
                    │  Return Cached  │      │  Start Workflow  │  │  Return      │
                    │  Audio URL      │      │  (Generate New)  │  │  "Generating"│
                    └─────────────────┘      └──────────────────┘  └──────────────┘
                                                           │
                              ┌───────────────────────────┼───────────────────┐
                              │                           │                   │
                              ▼                           ▼                   ▼
                    ┌─────────────────┐      ┌──────────────────┐  ┌──────────────────┐
                    │  AI Script Gen  │─────▶│  ElevenLabs TTS  │──▶│  Store in Convex │
                    │  (Action)       │      │  (Action)        │  │  Storage         │
                    └─────────────────┘      └──────────────────┘  └──────────────────┘
                                    │                                                  │
                                    │  Real-time Subscription (No Polling!)            │
                                    │  Status: pending → generating-script            │
                                    │          → generating-speech → completed        │
                                    │                                                  │
                                    ▼                                                  │
                    ┌──────────────────────────────────────────────────────────┐      │
                    │  UI Auto-Updates via Convex useQuery Subscription         │◀─────┘
                    │  All connected clients see status changes instantly!      │
                    └──────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Shared Cache**: One audio file per content+voice, shared across all users
2. **No Expiration**: Audio stays cached indefinitely (storage cheaper than regeneration)
3. **Auto-Regeneration**: Content updates trigger cache invalidation via contentHash (old audio files deleted to prevent orphans)
4. **Deduping**: Multiple simultaneous requests for same content queue behind one generation
5. **5 Predefined Voices**: Nina (primary), Alex, Sarah, David, Maya

## Schema

### contentAudios
- `contentId`: Reference to articleContents or subjectSections
- `contentType`: "article" | "subject"
- `contentHash`: For change detection
- `voiceId`: ElevenLabs voice ID
- `voiceSettings`: Stability, similarityBoost, style
- `status`: pending | generating-script | generating-speech | completed | failed
- `script`: Generated text with intonation markers
- `audioStorageId`: Reference to Convex storage
- `generationAttempts`: Prevent infinite retry loops

### userContentAudios
- `userId`: Who accessed the audio
- `contentAudioId`: Reference to shared audio
- `playCount`: Usage analytics
- `lastPlayedAt`: For "continue listening" feature

## Workflow

1. User requests audio for content
2. Check if cached audio exists with matching contentHash
3. If yes → Return audio URL immediately
4. If generating → Return "in progress" status
5. If no/stale → Start workflow:
   - Generate script using AI (Gemini via Vercel AI Gateway)
   - Convert to speech using ElevenLabs
   - Store in Convex storage
   - Update database

## Real-time Updates

Convex automatically pushes status changes to all subscribed clients:
- Frontend subscribes with `useQuery(api.audioStudies.getAudioStatus, { contentAudioId })`
- UI instantly updates when workflow changes status (pending → generating-script → generating-speech → completed)
- No polling required - this is Convex's real-time subscription model
- Multiple users see the same status simultaneously

## Voice Configuration

```typescript
PREDEFINED_VOICES = {
  nina: { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", style: "educational" },
  alex: { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", style: "energetic" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", style: "calm" },
  david: { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", style: "professional" },
  maya: { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", style: "friendly" },
};
```

## ElevenLabs v3 Audio Tags

Scripts use ElevenLabs v3 audio tags for emotional context:

**Emotional States**: `[excited]`, `[curious]`, `[calm]`, `[nervous]`, `[sorrowful]`
**Reactions**: `[sigh]`, `[laughs]`, `[whispers]`, `[gasps]`
**Cognitive Beats**: `[pauses]`, `[hesitates]`, `[stammers]`
**Tone Modifiers**: `[cheerfully]`, `[flatly]`, `[deadpan]`

Example: `"[excited] Today we're exploring something fascinating! [pauses] Did you know that [curious] every number has a unique story?"`

## Progress Tracking

See `progress.txt` for detailed completion status.

## Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test
```

## Dependencies

- `@ai-sdk/elevenlabs`: Already installed
- `@convex-dev/workflow`: Already configured
- `@repo/ai/config/elevenlabs`: Already updated to use AI SDK
