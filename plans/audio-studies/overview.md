# Audio Studies Feature

Enable Pro users to generate podcast-style audio from educational content using ElevenLabs.

## Architecture
- **Shared cache**: One audio per content+voice (minimize costs)
- **Auto-regeneration**: Content updates invalidate cache
- **Real-time**: Convex subscriptions for status updates
- **5 voices**: Nina (default), Alex, Sarah, David, Maya

## End-to-End User Flow

```mermaid
flowchart TD
    subgraph Frontend["Frontend (React)"]
        User["Pro User"]
        UI["Audio Player UI"]
        Selector["Voice Selector"]
    end

    subgraph Request["1. Request Audio"]
        User -->|"Click 'Generate Audio'"| RequestAPI["audioStudies.mutations.request"]
        RequestAPI -->|"Check Pro subscription"| ProCheck{"Active?"}
        ProCheck -->|"No"| Error1["Error: Pro required"]
        ProCheck -->|"Yes"| VoiceCheck["Validate voice"]
    end

    subgraph Cache["2. Cache Check"]
        VoiceCheck -->|"Check cache"| CacheCheck{"Cached?"}
        CacheCheck -->|"Yes + valid hash"| Cached["Return cached URL<br/>~100ms"]
        CacheCheck -->|"Generating"| Queued["Return 'generating' status"]
        CacheCheck -->|"No/stale"| StartWorkflow["Start workflow"]
    end

    subgraph Workflow["3. Workflow Pipeline"]
        StartWorkflow --> WorkflowMgr["workflow.start()"]
        WorkflowMgr --> Upsert["Upsert contentAudios record"]
        Upsert -->|"Status: pending"| GenScript["Action: generateScript"]
        GenScript -->|"Status: generating-script"| AI["Gemini AI"]
        AI -->|"Generate script with tags"| SaveScript["Save script"]
        SaveScript -->|"Status: generating-speech"| GenSpeech["Action: generateSpeech"]
        GenSpeech --> ElevenLabs["ElevenLabs API"]
        ElevenLabs -->|"Generate audio"| Storage["Convex Storage"]
        Storage -->|"Status: completed"| Complete["Workflow complete"]
    end

    subgraph Realtime["4. Real-time Updates"]
        UI -->|"useQuery subscription"| Subscribe["Subscribe to status"]
        Subscribe -->|"Auto-update"| ShowProgress["Show: pending → generating-script → generating-speech → completed"]
    end

    subgraph Playback["5. Playback"]
        Cached --> Play["Play audio"]
        Complete --> Play
        Play --> Track["Track user access"]
        Track --> History["Update listening history"]
    end

    subgraph Invalidation["6. Content Update (Future)"]
        ContentUpdate["Content updated"]
        ContentUpdate --> Invalidate["audioStudies.mutations.invalidate"]
        Invalidate --> DeleteStorage["Delete old audio from storage"]
        DeleteStorage --> ResetStatus["Reset to pending"]
    end

    User --> Selector
    Selector -->|"Select voice (Nina/Alex/Sarah/David/Maya)"| RequestAPI

    style Frontend fill:#e1f5ff
    style Workflow fill:#fff3cd
    style Realtime fill:#d4edda
    style Invalidation fill:#f8d7da
```

## Implementation

**See `IMPLEMENTATION.md` for complete implementation guide.**

## Files to Create

```
packages/ai/config/voices.ts                      # Voice configurations
packages/backend/convex/audioStudies/             # Main feature folder
├── schema.ts                                     # Database tables
├── queries.ts                                    # Public + internal queries  
├── mutations.ts                                  # Public + internal mutations
├── actions.ts                                    # AI generation
└── workflows.ts                                  # Orchestration
packages/backend/convex/articleContents/queries.ts    # Add getById
packages/backend/convex/subjectSections/queries.ts    # Add getById
```

## Status Flow
```
pending → generating-script → generating-speech → completed
                              ↓
                            failed
```

## Key Decisions
- ✅ Kebab-case status values (`generating-script` not `generating_script`)
- ✅ Store voice settings per audio (future-proof)
- ✅ No api.ts - mix public/internal in queries/mutations
- ✅ No unused functions - only what we need
- ✅ Content queries in their respective folders
- ✅ Uses AI SDK (not ElevenLabs SDK directly)

## Commands
```bash
pnpm typecheck
pnpm lint
```
