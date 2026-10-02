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
- **Try-out**: A free exam simulation surface with Pro access to worked solutions organized by country, exam, track, set, and section. Try-out routes use `/try-out/[country]/[exam]/[track]/[set]` with a section segment only for public section choices.
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
- **Post-auth admission**: The server-verified first-run decision after authentication that either requires onboarding or resumes one sanitized internal destination. It does not authorize access to destination data.
- **Learning region**: The onboarding choice that initializes an application locale and, when one exists, a Curriculum preference. It includes the product region `international`, so it is not an ISO country value.
- **Learning focus**: The onboarding choice between opening curriculum learning or try-out discovery first. It selects the first destination without restricting later access to either surface.
- **Material placement**: A source-owned relation connecting one canonical material asset to the exact Learning program and curriculum card group that presented it. It is interaction context, not canonical URL identity or a learner preference.
- **Learning context**: The verified page, Material placement, and tool policy facts available for one user interaction. A direct or SEO material visit has canonical context unless the request carries a valid Material placement.
- **NinaContextPack**: The immutable learning context snapshot built during authenticated admission and stored with the Nina turn for replay.
- **Continue Learning**: A signed-in user read model ranked from recent learning interactions. It must not be inferred for anonymous users.
- **Popularity**: Aggregate learning interest derived from view events and durable counters. Product reads use bounded read models, not raw event scans.
- **Lifetime counter**: A durable popularity count that continues after raw audit events expire.
- **Popularity retention**: Daily viewer keys prevent duplicate contributions only within their UTC day. Daily aggregate signals support finite windows for 365 days. Expiration removes these inputs after their consumers finish; queued events and durable lifetime counters remain authoritative for pending and processed work respectively.

## Nina

- **Nina turn**: One admitted user prompt, credit reservation, immutable learning context, provider usage, and durable response lifecycle. Confect owns admission and settlement; the Convex Agent component owns messages and streaming.
- **LearningCapability**: An internal education Module Nina can invoke for bounded evidence such as Nakafa retrieval, deterministic math, or external research.
- **Evidence**: Schema-derived facts, calculations, citations, content references, and limitations that constrain Nina's answer.
- **Capability output**: A persisted Agent tool result with bounded model-facing evidence, progressive artifacts, and an explicit failure when the invocation cannot finish. The evidence never exceeds its token budget; a truncation says what was omitted and how to ask for it. Agent stores the final result with the conversation so it survives reconnects.
- **Activity**: One native Agent tool invocation shown as a collapsed purpose row. Its children are published evidence artifacts, not an exhaustive specialist transcript.
- **Capability policy**: The per-turn decision that returns Allowed or Denied for a LearningCapability.
- **Pinned context**: The latest stored NinaContextPack reused when a continued chat is opened away from a verified learning asset.
- **Page fetch**: The one current-page Nakafa content read for a verified learning page. Generation performs it before the first model step and places the page, within its token budget, in Nina's stable prompt context; the model reads other sections through Nakafa. Only pages with signed Markdown are verified; try-out and topic pages have none.
- **Conversation summary**: A chat's rolling synopsis of turns older than its newest verbatim turns. It updates after completed turns, bounds Nina's provider context for long conversations, and never replaces the stored transcript.
- **Learner profile**: Account facts Nina reads for a turn: onboarding focus and region, the preferred try-out country, and the latest finished try-out by section. It is derived on read and never stored with a turn.
- **Learner memory**: At most 30 short facts a learner shared about themself, kept only while the learner turns memory on. Each fact leaves with its source chat, and turning memory off forgets all of them.
- **Question focus**: One finished try-out question a learner asks Nina about from their review. Admission freezes it into the NinaContextPack only for the attempt owner, a finished section, and a plan that grants review answers. Continued turns keep it while that entitlement holds.

## AI Gateway

- **Space**: Whose data a row or a model call belongs to. A personal space is one account's own data.
- **Gateway handle**: A language model prepared for one purpose, model key, and space, with Nakafa's no-training routing, reasoning defaults, deadlines, and spend attribution. It is the only way Nakafa code reaches a model.
- **Purpose**: Why Nakafa calls a model, such as chat, specialist, background, suggestion, or presentation. It sets a handle's deadlines and effort and splits spend reports.
- **Gateway failure**: The one classification of a failed model call, carrying routing facts only and never the prompt, the answer, or a provider message.

## Evaluation

- **EvalCase**: A schema-derived test input with deterministic expected evidence, routing, or trace assertions.
- **EvalSuite**: A named collection of EvalCases for one Nina turn or LearningCapability behavior boundary.
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

## Nakafa School

- **Tenant**: One school or foundation (yayasan) using Nakafa School, served by the same deployments as every other tenant. Its data is isolated by every School function, never by the client.
- **Tenant slug**: A tenant's public address, the `slug.nakafa.com` label and the `/[locale]/school/[slug]` route segment. It names the tenant context of a request; it never grants access.
- **Unit**: One school level inside a tenant, such as the SD, SMP, or SMA of a foundation, with its own NPSN. An archived unit stays readable and refuses writes.
- **Period**: One school year or semester of a tenant. Promotion archives a period and moves students into the next one.
- **Cohort**: A rombel, the administrative class group that rapor, promotion, and Dapodik use. It is separate from a Classroom.
- **Classroom**: The learning space for one subject in one Cohort, or one per Cohort in SD.
- **Person**: Someone in one tenant, separate from a User. A Person can exist before any account and is claimed later; an account holds at most one Person per tenant.
- **Claim**: Binding a Person to the account that controls the Person's invite address. It happens automatically when an account's verified email equals the invite address.
- **Invite**: A pending offer of one Person to the account whose verified email equals its address.
- **Grant**: One role held by one Person over the whole tenant or one unit, standing or temporary.
- **Built-in role**: One of the fixed roles every tenant shares: Owner, Admin, Principal, Deputy, Teacher, Counselor, Staff, Student, Guardian, Proctor, Auditor, and Integration.
- **Owner**: The role that holds every roles-granted action and alone may appoint Owners and Admins. A tenant keeps at least one claimed Owner.
- **Custom role**: A tenant's clone of a built-in role with a subset of the actions its editor holds.
- **Kind**: One type of subject access is decided on, such as the tenant, a unit, a Person, or a grant, declared once with its actions, relations, and audited changes.
- **Action**: One `source.verb` permission, such as `grant.manage`, evaluated against one kind of subject.
- **Relation**: A link between the caller's Person and a subject that grants actions without a role, such as a classroom teacher or a verified guardian.
- **Condition**: State that refuses an action whatever the roles, such as a suspended tenant, an archived unit, or a closed exam.
- **Access decision**: The outcome of one action on one subject: allowed, or refused for the resource, a role, or a condition.
- **Viewer capabilities**: The actions the server computed the caller may perform, returned with a query as `can` so the UI never guesses.
- **Object reference**: A typed `{ kind, id }` pointer to an object of any declared kind, checked for access whenever it is read.
- **Space**: Whose data a row or a model call belongs to: one account (personal) or one tenant.
- **Journal**: The one record of audited changes for every space, written in the same transaction as the change and read by the audit log and by consumers.
- **Journal entry**: One immutable audited change: its owner space, actor, subject, and change, holding IDs and codes only.
- **Published change type**: A change type its kind exposes to journal consumers such as notifications, webhooks, and exports.
- **Operator**: Nakafa staff who provision tenants. Not the school's Admin, whom Indonesian schools also call operator sekolah.
- **Operator visit**: An operator's temporary, audited admin or auditor grant inside one tenant, ended on schedule.
