# Nakafa Context

This glossary records stable domain terms used by Nakafa code and PR review. It is not an implementation plan.

## Learning Engagement

- **Canonical asset**: A material, question, article, or Quran asset owned by the content system. Other product surfaces group or navigate over references to these assets.
- **Learning context**: The verified page, placement, and tool policy facts available for one user interaction.
- **NinaContextPack**: The immutable learning context snapshot built before one Nina turn and stored on chat messages for replay.
- **Continue Learning**: A signed-in user read model ranked from recent learning interactions. It must not be inferred for anonymous users.
- **Popularity**: Aggregate learning interest derived from view events and durable counters. Product reads use bounded read models, not raw event scans.
- **Lifetime counter**: A durable popularity count that continues after raw audit events expire.
- **Integrity Module**: Permanent operational code that proves raw event coverage, checkpoint progress, lifetime counter inclusion, and rank-index consistency.

## Nina

- **NinaHarness**: The package-owned Effect service with the only app-facing `stream` Interface for Nina chat turns.
- **LearningCapability**: An internal education Module Nina can invoke for bounded evidence such as Nakafa retrieval, deterministic math, or external research.
- **MathReasoning**: The internal math LearningCapability Module that produces verified, pedagogical math work for learner questions ranging from beginner level to professor-level use.
- **MathWork**: The canonical structured evidence for one Nina math answer, including assumptions, computations, derivation steps, verification status, pedagogical projection, and future visual intent.
- **MathWorkStep**: One semantic derivation step in a MathWork that can be projected at atomic, school, advanced, or professor detail levels.
- **MathWorkArtifact**: A compact renderable projection manifest for a MathWork, such as a formula card, step list, table, plot intent, or future 3D visual intent.
- **VisualIntent**: Math-owned metadata describing how a MathWork can be visualized, without requiring the first implementation to render that visualization.
- **Verification lane**: The trust label on a MathWork answer or step: verified, derived, pedagogical, or speculative.
- **Math copy projection**: The app-owned localization seam that turns MathWork semantic keys and values into student-facing Indonesian or English copy.
- **Math prompt Adapter**: The AI-owned seam that formats internal model instructions from MathWork evidence without sharing prompt prose with UI dictionaries or persisted learner evidence.
- **Structured MathRequest**: The schema-owned semantic math input consumed by MathReasoning. It carries operation, expression, variables, bounds, points, givens, and requirements without learner-language parser phrases.
- **Math language Adapter**: An AI-owned or locale-parser seam that translates learner prose into a Structured MathRequest. Adding languages must happen here, not inside `packages/math`.
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
