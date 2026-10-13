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
- **Response**: One question's answer format: single choice, multiple choice, category (the Benar/Salah table), short answer, or rubric. The backend `confect/response` module owns its frozen spec, the learner's selection, and its outcome; try-outs and School assessments use it as peers.
- **Outcome**: How one answer scores: correct, incorrect, partial with earned points, or pending until the grader decides. A pending answer never counts as zero and keeps its score provisional.
- **Live-attempt gate**: The one admission check every learner write to a running try-out passes, and every School assessment write will pass. The checks run in one order: owner, open attempt, proctor lock, device session, the attempt deadline (a finish checks it before it reads the section), the running section and its integrity, the live deadline (an answer checks the earlier of the attempt and section deadlines), and then, for an answer, the question's stored answer and its version. A refused write writes nothing. `confect/assessment/gate` owns it, and each kind of attempt provides the store it loads from and writes to.
- **Attempt refusal**: The first gate rule a write failed: missing (no such target for this learner, including another learner's), attempt closed, locked, other device, section closed, or expired; an answer whose version is not newer than the latest write of its question, a clear included, is refused last, as stale. Each product maps it onto its own error codes.
- **Question worth**: The points one placed question is worth, read only through the contract's `questionPoints`: its authored points or one, and a rubric's derived total.
- **Penalized scoring**: A set strategy that adds each section's signed marks for a correct, wrong, or blank answer, such as +4, -1, and 0, times each question's worth.
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
- **Popularity**: Aggregate learning interest derived from view events and a windowed counter. The one ranking kept is the homepage's: material lessons, global scope, the last seven UTC days. Product reads use bounded read models, not raw event scans.
- **Popularity retention**: Daily viewer keys prevent duplicate contributions only within their UTC day. Daily aggregate signals are kept for the seven-day window: the daily pass reads the one leaving it and the weekly pass reads those inside it. Expiration removes these inputs after their consumers finish; queued events remain authoritative for pending work.

## Nina

- **Nina turn**: One admitted user prompt, credit reservation, immutable learning context, provider usage, and durable response lifecycle. Confect owns admission and settlement; the Convex Agent component owns messages and streaming.
- **Turn timing**: The waits a Nina turn stores, as numbers of milliseconds after its admission and never any text: when a run took the turn (`claimedMs`), when the run was about to call the model (`readyMs`), when the model first produced a part the page shows (`progressMs`), and when it first wrote a word of the answer (`tokenMs`). A turn keeps only the stages it reached.
- **Start check**: The one check that admission schedules for the moment a queued Nina turn must have started, 30 seconds after the admission. It settles a turn whose run never started as a response timeout, with its credits back, and leaves a turn that was claimed or settled alone.
- **Settlement grace**: How long after the sweep first finds a Nina turn open past its deadline the turn is ended without the Agent journal, if it is still open: three sweeps, 15 minutes. It makes sure that a settlement that fails every time still ends in a free chat and the credits back. The turn fails as unknown, or is cancelled when the learner had stopped it, and an answer the journal does hold still completes it. A hold that cannot be paid back is never dropped for it: the ending then changes nothing and the next sweep tries again.
- **LearningCapability**: An internal education Module Nina can invoke for bounded evidence such as Nakafa retrieval, deterministic math, or external research. It is one definition: its name, the Schema of its input, the description and tool policy the model reads, the rule that offers it in a turn, and its run. The Capability registry lists the definitions.
- **Capability registry**: The one record of Nina's capabilities, under the name the model calls each by. The tools Nina is offered, the capability policy, and the tool section of her prompt are all built from it, in its order, which is part of the prompt prefix that the provider caches.
- **Evidence**: Schema-derived facts, calculations, citations, content references, and limitations that constrain Nina's answer.
- **Capability output**: A persisted Agent tool result with bounded model-facing evidence, progressive artifacts, and a capability outcome when the run fell short. The evidence never exceeds its token budget; a truncation says what was omitted and how to ask for it. Agent stores the final result with the conversation so it survives reconnects.
- **Capability outcome**: How one capability run fell short of done: partial (evidence kept although a part failed), empty (ran and found nothing), limit (over a stated limit), denied (refused by policy), or failed (nothing usable). The shared runner settles it against the artifacts before the result is stored, so a run that loaded evidence is never failed, a run that lost evidence is never plainly done, and a run that gathered no card and states no outcome is empty, unless its capability is text-only (it publishes no card, so its answer is the text). The page reads a stored result by the same rule, so a result stored before every run settled an outcome reads as a fresh one would, and a result the rule leaves without an outcome is done. The Activity row takes its label from it.
- **Activity**: One native Agent tool invocation shown as a collapsed purpose row. Its children are published evidence artifacts, not an exhaustive specialist transcript.
- **Capability policy**: The per-turn decision that returns Allowed or Denied for a LearningCapability. It fails closed: a turn without Nina's context pack allows nothing, and a capability is allowed only by its own rule, which every definition must give.
- **Turn context**: The runtime facts of one Nina turn, such as the current page, the date, the tool policy, and the memories the turn recalls. They travel in a block at the start of the newest learner message, are never stored in the thread, and name the page the learner is on now, even when the chat began elsewhere or the turn retries a question asked elsewhere. The system prompt and the history before the message stay the same from step to step and turn to turn, which is what the provider caches.
- **Page fetch**: The one current-page Nakafa content read for a verified learning page. Generation performs it before the first model step and places the page, within its token budget, in Nina's stable prompt context; the model reads other sections through Nakafa. Only pages with signed Markdown are verified; try-out and topic pages have none.
- **Conversation summary**: A chat's rolling synopsis of the oldest turns, which a fold takes out of the verbatim history once that costs more than its token budget. It updates after a completed turn when a fold is due, bounds Nina's provider context for long conversations, and never replaces the stored transcript.
- **Verbatim history**: The complete turns after a chat's Conversation summary, read by turn order and shown to the model whole, each with its question and answer. A cancelled or failed turn is not in it, and a question the learner asked again is in it only once, in its newest asking.
- **Learner profile**: Account facts Nina reads for a turn: onboarding focus and region, the preferred try-out country, and the latest finished try-out by section. It is derived on read and never stored with a turn.
- **Learner memory**: What a learner shared about themself, as many memories as they write. A memory holds a title, words, or both. The title is optional, up to 80 characters, and only the learner writes it. The words are up to 2000 characters and free to hold Markdown. Memory is on for everyone until the learner pauses it, and the learner reads, writes, edits and deletes memories under Settings, AI, Memory. The learner writes pure text. A memory Nina wrote is one sentence of up to 280 characters with a kind (level, goal, style, struggle, or situation), and one the learner wrote takes a kind when a later chat says it again. Nina never replaces words the learner wrote: a chat that says something else about such a memory adds a memory of Nina's and leaves the learner's as it is. The words and the title are each sealed for their learner. A memory is independent of chats, so deleting a chat deletes no memory. Only the learner, the end day of a situation Nina dated, and account deletion remove one. No function reads all the memories of a learner: Nina reads them through the Learner portrait, which is built from the memories it has not read yet, 40 at a time and the oldest first, and through Memory recall and the Memory capability, which find memories through the memory index, and every read is bounded.
- **Memory index**: The rows that link each memory to the topics it was said at and to each word of its title and words, 104 links at most. A topic is a lesson or a path above a page, kept in plain text. A word is kept as a keyed hash, so the database matches a word again without being able to read it, and another learner's hash for the same word differs. Each row holds the time its memory was confirmed, so a lookup meets the memories confirmed last first. Every writer and every deleter of a memory keeps the index in step with it in the same transaction.
- **Memory search**: The one function that finds a memory by words and topics through the memory index, the best match first. A lesson that is open counts most, then a path above it, then a word. It reads a bounded number of documents whatever the learner keeps.
- **Learner portrait**: One sealed text of at most 1,200 characters about a learner, written in the background from their memories, and, once it exists and while memory is on, in the Learner section of the system prompt, within 300 tokens. It holds what stays true for months (who they are, what they aim for, how they like to learn, what they find hard), never anything with an end date, and changes rarely, so the cached prompt prefix survives. It is derived data and has its own word because Learner profile already names the account facts. Each build reads the next 40 memories it has not read, the oldest first, and asks for the next build while memories remain, so none is skipped. A memory the learner deletes or rewrites takes its text out at once, and a build from scratch writes it again.
- **Memory recall**: The few memories, at most 8 and at least 3 when the learner has them, that fit one turn: the search of the memory index by the words of the learner's message and the topics of the open page, filled up to 3 with the most recently confirmed. They travel in a "Memories" list in front of the learner's message, outside the cached prompt prefix, and a turn with none has no list and no heading.
- **Memory capability**: The read-only LearningCapability `memory`, with one input, the query. It answers with the memory search for the words of the query, at most 6 memories and 1,500 tokens, or says that nothing was found. It makes no model call, costs no credits, is not offered while memory is paused, and shows in the chat as one activity row that opens to nothing. What it finds is read in the next step of the turn and is never stored in the chat, which keeps only a note, so a public chat, a later turn and a deleted memory leave no copy of the words. A memory it returns is not thereby confirmed.
- **Memory capture**: The follow-up step after a complete turn that saves what the learner's own words say about themself. Plain code gates the message, one background model call proposes memories with a quote and one sentence of up to 280 characters each, and plain code checks every quote against the message before anything is written.
- **Question focus**: One finished try-out question a learner asks Nina about from their review. Admission freezes it into the NinaContextPack only for the attempt owner, a finished section, and a plan that grants review answers. Continued turns keep it while that entitlement holds.

## AI Gateway

- **Gateway handle**: A language model prepared for one purpose, with its reasoning default and deadlines. It is the only way Nakafa code reaches a model.
- **Purpose**: Why Nakafa calls a model, such as chat, specialist, background, suggestion, or presentation. It sets a handle's deadlines and reasoning effort.
- **Gateway failure**: The one classification of a failed model call, carrying routing facts only and never the prompt, the answer, or a provider message.

## Knowledge Search

- **Section**: One heading section of a lesson or article, or one signed chunk of six verses of a surah, in one language. Its place, the document and its ordinal, is the same in every language, so a question in one language can lead to the same place in another.
- **Section index**: The derived rows of every Section of the active release, with its text for search by words and a vector for search by meaning. A build makes it from the active release, and Nina's Nakafa search trusts it only while its record names the active release and the embedding model; otherwise Nina searches by words.
- **Section version**: What a document's Sections were made from: the section format, the embedding model, and the signed facts of the source. A build passes over a document whose version the index holds, a Section whose text its document holds is never embedded again, wherever it stands now, and an unchanged Section is not written again either.

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

- **Tenant**: One school or foundation (yayasan) using Nakafa School, served by the web project and the Convex deployment of its data cell. Its data is isolated by every School function, never by the client.
- **Data cell**: One `www` project and one Convex deployment, with a registrable domain of its own. A tenant lives in one cell, and an account has one home cell. The `us` cell is live and the `eu` cell is planned.
- **Tenant slug**: A tenant's public address, the `slug.nakafa.com` label under the domain of its data cell. It names the tenant context of a request; it never grants access.
- **Unit**: One school level inside a tenant, such as the SD, SMP, or SMA of a foundation, with its own NPSN. An archived unit stays readable and refuses writes.
- **Locale settings**: The country and the contract currency that a tenant holds, and the time zone and the content language that each unit holds. The interface language is not one of them: it follows the learner's `NEXT_LOCALE` cookie.
- **Organisation policy**: A choice an Owner makes for the whole tenant: whether students may open forum threads, whether Nina is on, and which email domains it admits. An empty list of domains admits every address; otherwise only an address on one of them may claim an invite. The first two choices are stored until the School features they switch exist.
- **Contract**: What a school signed with Nakafa when it was opened: the plan of its licence, its modules, and the versions of its data processing agreement and content licence. The journal records it with the tenant's provisioning; the rights it grants are built later.
- **Provisioning**: Opening a tenant with its units, its first Owner as an unclaimed Person with an invite, and its journal entries in one transaction. An Operator does it with the deployment's key, so no browser can.
- **Period**: One school year or semester of a tenant. Promotion archives a period and moves students into the next one.
- **Cohort**: A rombel, the administrative class group that rapor, promotion, and Dapodik use. It is separate from a Classroom.
- **Classroom**: The learning space for one subject in one Cohort, or one per Cohort in SD.
- **Person**: Someone in one tenant, separate from a User. A Person can exist before any account and is claimed later; an account holds at most one Person per tenant.
- **Claim**: Binding a Person to the account that controls the Person's invite address. It happens automatically when an account's verified email equals the address of an unexpired invite, the tenant is active, and the tenant's email domains admit the address; it is the one place an account is matched by its email. The journal records the claim method.
- **Invite**: A pending offer of one Person to the account whose verified email equals its address. It expires 14 days after it is created, and an expired invite is never claimed.
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
- **Space**: Whose data a row belongs to: one account (personal) or one tenant.
- **Journal**: The one record of audited changes for every space, written in the same transaction as the change and read by the audit log and by consumers.
- **Journal entry**: One immutable audited change: its owner space, actor, subject, and change, holding IDs and codes only.
- **Published change type**: A change type its kind exposes to journal consumers such as notifications, webhooks, and exports.
- **Operator**: Nakafa staff who provision tenants. Not the school's Admin, whom Indonesian schools also call operator sekolah.
- **Operator visit**: An operator's temporary, audited Auditor grant inside one tenant, approved by the school's Owner or Admin and ended on schedule.
