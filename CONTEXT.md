# Nakafa Context

This glossary records stable domain terms used by Nakafa code and PR review. It is not an implementation plan.

## Learning Engagement

- **Canonical asset**: A material, question, article, or Quran asset owned by the content system. Other product surfaces group or navigate over references to these assets.
- **Question bank**: The source-owned pool of immutable question assets. A question bank item is reusable by try-outs and is not a public practice page.
- **Try-out**: A premium exam simulation surface organized by country, exam, track, set, and section. Try-out routes use `/try-out/[country]/[exam]/[track]/[set]` with a section segment only for public section choices.
- **Try-out country**: The country-scoped discovery node for exam families, such as Indonesia. It owns localized country page copy and route slugs.
- **Try-out exam**: A stable exam-family key under one country, such as `snbt` or `tka`. Exam keys do not include yearly suffixes.
- **Try-out track**: The source-owned discovery layer between exam and set. Tracks group sets by the exam's natural offer shape, such as an SNBT year or a TKA subject.
- **Try-out set**: One attemptable exam package under a try-out track. It owns section membership, scoring strategy, and public set copy.
- **Try-out section**: One timed question group inside a try-out set. Sections reference question bank source paths; visible sections have public routes, while internal-entry sections are runtime-only.
- **Try-out attempt snapshot**: The immutable section configuration and question placements captured when an attempt starts. It remains valid for the life of that attempt even when the authored try-out catalog changes.
- **IRT scale version**: An immutable scoring scale for one try-out set. Published attempts keep the exact scale version and item parameters used for scoring.
- **Learning program**: A durable educational pathway such as a school curriculum, assessment preparation track, or institution program. Public curriculum pages present Learning programs through localized routes.
- **Curriculum preference**: A signed-in learner's default school curriculum for browsing curriculum surfaces. It does not replace an explicit curriculum URL and it is not the source of generated learning plans.
- **Curriculum index**: A public discovery surface that lists school curricula and links to their curriculum roots. It is not personalized.
- **Material placement**: A source-owned relation connecting one canonical material asset to the exact Learning program and curriculum card group that presented it. It is interaction context, not canonical URL identity or a learner preference.
- **Learning profile**: A signed-in learner's onboarding and planning state for interests, stage, and an active learning plan. It is separate from Curriculum preference.
- **Learning context**: The verified page, Material placement, and tool policy facts available for one user interaction. A direct or SEO material visit has canonical context unless the request carries a valid Material placement.
- **NinaContextPack**: The immutable learning context snapshot built before one Nina turn and stored on chat messages for replay.
- **Continue Learning**: A signed-in user read model ranked from recent learning interactions. It must not be inferred for anonymous users.
- **Popularity**: Aggregate learning interest derived from view events and durable counters. Product reads use bounded read models, not raw event scans.
- **Lifetime counter**: A durable popularity count that continues after raw audit events expire.
- **Integrity Module**: Permanent operational code that proves raw event coverage, checkpoint progress, lifetime counter inclusion, and rank-index consistency.

## Nina

- **NinaHarness**: The package-owned Effect service with the only app-facing `stream` Interface for Nina chat turns.
- **LearningCapability**: An internal education Module Nina can invoke for bounded evidence such as Nakafa retrieval, deterministic math, or external research.
- **Evidence**: Schema-derived facts, calculations, citations, content references, and limitations that constrain Nina's answer.
- **EvidenceEnvelope**: The schema-derived LearningCapability result that carries status, compact model-visible evidence, references, and limitations.
- **CapabilityTrace**: A bounded operational summary of LearningCapability execution for support, integrity checks, and evals. It is not a raw transcript.
- **Capability policy**: The per-turn decision that returns Allowed, Denied, or NeedsConfirmation for a LearningCapability.
- **Pinned context**: The latest stored NinaContextPack reused when a continued chat is opened away from a verified learning asset.
- **Page fetch**: The one permitted current-page Nakafa content read for a verified learning page.

## Evaluation

- **EvalCase**: A schema-derived test input with deterministic expected evidence, routing, or trace assertions.
- **EvalSuite**: A named collection of EvalCases for one NinaHarness or LearningCapability behavior boundary.
- **EvalRun**: A recorded execution of an EvalSuite with bounded evidence and trace summaries.

## Forum Conversation

- **Forum Conversation**: The opened discussion surface for one class forum, usually shown as the right-side panel beside the forum list.
- **Transcript**: The ordered message log rendered inside a Forum Conversation.
- **Viewport**: The visible scroll window over a Transcript.
- **Placement**: The intended Viewport target, such as the latest message edge or a specific post.
- **Snapshot**: A persisted restorable Viewport state for one Forum Conversation.
- **Navigation History**: The ordered semantic Viewport positions a user can return to inside one Forum Conversation.
- **Latest Affinity**: The user state where a Forum Conversation Viewport is attached to the newest Transcript edge.
