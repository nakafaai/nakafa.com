# Nakafa Context

This glossary records stable domain terms used by Nakafa code and PR review. It is not an implementation plan.

## Learning Engagement

- **Canonical asset**: A material, question, article, or Quran asset owned by the content system. Other product surfaces group or navigate over references to these assets.
- **Learning program**: A durable educational pathway such as a school curriculum, assessment preparation track, or institution program. Public curriculum pages present Learning programs through localized routes.
- **Curriculum preference**: A signed-in learner's default school curriculum for browsing curriculum surfaces. It does not replace an explicit curriculum URL and it is not the source of generated learning plans.
- **Curriculum index**: A public discovery surface that lists school curricula and links to their curriculum roots. It is not personalized.
- **Learning profile**: A signed-in learner's onboarding and planning state for interests, stage, and an active learning plan. It is separate from Curriculum preference.
- **Learning context**: The verified page, placement, and tool policy facts available for one user interaction.
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
