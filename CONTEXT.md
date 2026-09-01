# Nakafa Context

This glossary records stable domain terms used by Nakafa code and PR review. It is not an implementation plan.

## Public Artwork

- **Public artwork**: A reviewed 1200 by 630 visual assigned to one stable Nakafa subject, learning stage, program, exam, or product surface. Cards and social metadata may reuse the same artwork.
- **Artwork locale**: The language variant of Public artwork. When a requested variant is absent, English is the visual fallback; this rule never applies to Signed content delivery.
- **Universal artwork**: Public artwork whose imagery does not depend on language. Nakafa records it as the English default for every application locale.

## Content Publication

- **Supported application locale**: A locale code recognized by the shared Aksara contract. Support does not activate public product routes or prove that every authored content family is ready.
- **Candidate application locale**: A supported application locale whose reviewed sources can be exercised through an authenticated local preview while it remains unavailable on public product routes.
- **Active application locale**: A supported application locale included in the authenticated active Aksara publication and enabled by Nakafa public routing. Activation requires complete publication evidence, not only an application dictionary or preview artifact.
- **Signed content delivery**: The resolution of one exact authored identity to an authenticated Aksara artifact for a specific application locale and route. Delivery fails closed when that signed identity is absent and never substitutes another locale.

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
- **Onboarding profile**: A signed-in user's three first-run answers and completion state. Incomplete answers are resumable drafts; after completion, normal role and preference settings may change independently.
- **Learning region**: The onboarding choice that initializes an application locale and, when one exists, a Curriculum preference. It includes the product region `international`, so it is not an ISO country value.
- **Learning focus**: The onboarding choice between opening curriculum learning or try-out discovery first. It selects the first destination without restricting later access to either surface.
- **Material placement**: A source-owned relation connecting one canonical material asset to the exact Learning program and curriculum card group that presented it. It is interaction context, not canonical URL identity or a learner preference.
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

## Privacy

- **Analytics consent decision**: A grant or denial for optional product analytics under one privacy-notice version. Missing, stale, unreadable, DNT, or Global Privacy Control state always keeps product analytics off.
- **Account consent decision**: A signed-in account's Analytics consent decision for one category, with a server-owned decision time. It never inherits an anonymous browser decision.
- **Anonymous consent decision**: A browser-local Analytics consent decision used only while no account is authenticated. Account sign-out preserves it without treating it as account state.
- **Analytics eligibility**: The current consent and account-lifecycle proof required before a browser or backend analytics event may be admitted. Queued backend delivery rechecks eligibility around external IO.
- **Product analytics capture**: The consent-aware admission of one optional backend product event. Failure to admit or queue it never changes the business operation that produced the event.
- **Operational exception report**: A minimized service-reliability report with a fixed error name and message, code stack frames, and bounded technical context. It carries no account or user identifier and no raw error message, cause, request payload, or user content. It is separate from optional product analytics.

## Billing

- **Checkout admission**: The account-lifecycle revalidation performed after a checkout is created and before its link is released. Its result is Admitted or Unavailable; integration failures remain distinct.

## Forum Conversation

- **Forum Conversation**: The opened discussion surface for one class forum, usually shown as the right-side panel beside the forum list.
- **Transcript**: The ordered message log rendered inside a Forum Conversation.
- **Viewport**: The visible scroll window over a Transcript.
- **Placement**: The intended Viewport target, such as the latest message edge or a specific post.
- **Snapshot**: A persisted restorable Viewport state for one Forum Conversation.
- **Navigation History**: The ordered semantic Viewport positions a user can return to inside one Forum Conversation.
- **Latest Affinity**: The user state where a Forum Conversation Viewport is attached to the newest Transcript edge.
