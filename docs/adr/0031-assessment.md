# ADR 0031: One Assessment Model For Try-Outs And School Exams

## Status

Accepted on 13 October 2026 with owner decisions K1, K6, K7, K12, K14, K16, and
K17. The owner approved decisions K1 to K20 on that day. This ADR supersedes ADR
0003.

The item model and the document contract are decided for program wave A, the
first delivery wave of the School program. The engine cutover, the shared
player, and the removal of the try-out tables are program wave B. Calibration
and analysis are program wave C. Implementation Status lists what is live today.

## Context

Nakafa today runs try-outs on one engine, and it has no school exams. Measured
on Aksara commit `edadc28a9d` on 13 October 2026, these are the facts
that the model must change:

- The question bank holds 1,850 items, the question folders that hold a locale
  question file in `packages/corpus/question-bank`. This change counted them on
  Aksara commit `edadc28a9d`. The program measured their kinds as 1,790 single
  choice, 30 multiple choice, 30 true or false by category, 0 short answer, and
  0 rubric, and this change did not recount the kinds.
- Figures are JSX components inside MDX. In `packages/corpus/question-bank`,
  `MathVisual` appears in 109 files, `LineEquation` in 127, `NumberLine` in 15,
  `Mermaid` in 12, and `UnitCircle` in 3. This change checked those counts with
  `git grep -l -F` on the tags. The per-set components, `Set<N>Question<M>` and
  their kinds, appear in 87 files with 93 uses, counted with `git grep`. Their
  definitions are in `apps/www/lib/content/renderer/client/snbt/general`.
  `packages/contracts/src` of the Aksara repository holds no image or media type
  schema.
- A reading passage is not an entity. Each item copies it into its body, and
  `stimulusKey` only groups the items (`packages/contracts/src/question/item.ts`,
  line 251). Sibling items with the same `stimulusKey` must present the same
  stimulus (`.agents/skills/nakafa-content/references/questions.md` in the Aksara
  repository).
- The item body is compiled MDX, which is code. A school cannot render it with
  its own tools and cannot export it as QTI. Nina reads the raw MDX of each
  question (`packages/backend/confect/nina/focus.ts`, the `questionMdx` field),
  and projects it to Markdown for the prompt
  (`packages/backend/confect/nina/prompt/focus.ts`).
- The scoring strategies are `irt`, `penalized`, and `raw`. The IRT strategy
  uses a 2PL model with provisional parameters. Main has no calibration job
  (`packages/backend/confect/tryouts/runtime/estimate.ts`).
- Multiple choice and category answers are all or nothing in code
  (`packages/backend/confect/response/evaluation.ts`).
- The player (`apps/www/components/player`) has no calculator, formula sheet,
  option elimination, highlighter, notes, line reader, or accommodations. It
  shows a section as a list or one item at a time, and a learner can end a
  section before its time runs out, from a confirmation dialog
  (`apps/www/components/player/finish.tsx`).
- `packages/backend/confect/response` rewrites the option, category, statement,
  and rubric shapes that the Aksara contract already holds. One shape then has
  two sources of truth.

## Decision

### 1. One item model for Nakafa content and school items

- `ItemFamily` holds a language-neutral identifier.
- `ItemVersion` holds one language's document, interactions, scoring rules,
  explanation, and a content hash. A version never changes after it is used.
- The answer key of a version is its own record, named by the version's hash and
  delivered only to an entitled reader. A prompt, a paper, and a paper bundle
  never carry a key.
- `Placement` only points to a version in a frozen manuscript.
- `Stimulus` stands alone, and one group of items shares it.
- A teacher's question is school data in the school's own cell. The Aksara
  question schema reads it read-only. It is not signed, it is not in the Aksara
  catalogue, and each row records the contract version it was written with (K1).
  That version is migration bookkeeping only: an index lets a contract release
  find the rows it has not rewritten yet. No reader dispatches on it and no
  renderer keeps an older shape (ADR 0018): a major contract release migrates
  every school item row in its own release train, and readers decode only the
  current shape.

### 2. The item body is a structured document, not code

- The assessment document is a structured tree of paragraphs, headings, lists,
  tables, math, and figures, encoded as ProseMirror-compatible JSON so the editor
  works on the same document. Math is stored once as LaTeX; MathML is rendered
  from it (KaTeX 0.19 with `output: "htmlAndMathml"`), never stored.
- A stored document is encoded JSON text in a string field, not a nested Convex
  value, because every node adds two levels of nesting (the node object and its
  `content` array) and Convex allows 16 levels in a whole document
  (https://docs.convex.dev/database/types#limits). The schema bounds the node
  depth of a document at 16. The size limit applies to the complete row: every
  write of an item version (a publication or a teacher's save) checks the encoded
  size of the whole record, its documents, interactions, rules and hash included,
  against Convex's 1 MiB per document, and refuses it before the write.
- A figure is one of the published components (`MathVisual`, `NumberLine`,
  `LineEquation`, `UnitCircle`, `Mermaid`) or an image with alternative text. The
  image form has no schema yet, and wave A adds one with the document contract.
  The per-set figure components of the SNBT question bank (`Set<N>Question<M>`,
  with kinds such as `Graph` and `SalesChart`) are not in this list. Each kind
  takes one of these forms, or it is removed, in the release that migrates the
  corpus, and its form is recorded here before that release. No release may
  contain a figure outside this list.
- Aksara still writes MDX. Its compiler produces the document, and Tiptap edits
  the same document.
- The formula node is Nakafa's own Tiptap node, with KaTeX 0.19 and MathLive
  input. It is not a community formula extension (K16).
- The renderer contract is in ADR 0018.

### 3. The interaction catalog follows QTI 3

- Choice: single, or multiple with a minimum and a maximum.
- A true or false matrix, matching, ordering, and choice inside a text.
- Text entry, number entry with fractions and units, and math entry.
- An image area, gap fill, a point and line graph, and an extended response
  with a rubric.
- File upload and audio are planned.
- Every interaction works with a keyboard and a screen reader (WCAG 2.2 AA).

Math entry is accepted automatically only when a deterministic check proves the
answer: the canonical forms of both expressions are the same under `isSame`, or,
for expressions without free variables, `isEqual` returns true (exact numbers
compare exactly; a float compares within the interaction's stated tolerance).
Any other `true` about expressions with free variables comes from sampling and is
treated as a sample. The engine is Cortex Compute Engine
(`@cortex-js/compute-engine`, planned: it is not in the backend manifest today).
In the pinned version (0.152.0, read in its `compare.ts` at the release commit)
`isEqual` runs with the prover off and never samples; a contract test pins that
(`(x+1)^2` against `x^2+2x+1` stays undefined under `isEqual`), so an upgrade
that adds a sampling path to `isEqual` fails the test before it can grade.
Three facts about that engine shape the rule. `isSame` checks structure only.
`isEqual` checks value, and it can return `undefined` for two expressions that
are equal. `isIdenticallyEqual` samples random values, so `true` is strong
evidence and not a formal proof. The engine version is pinned, because issue
#326 appeared in 0.98.0.

A sampled verdict from `isIdenticallyEqual` is not a proof. It is accepted only
where the exam profile allows it, which means practice and consumer try-outs,
and it is recorded as sampled. In a school exam, sampled verdicts and unproven
answers go to the teacher.

### 4. Scoring rules are data

- Every interaction stores its own scoring rule: all or nothing, points per part,
  or a rubric.
- The defaults come from the exam profile. SNBT is all or nothing. The AKM
  complex multiple choice scores 2, 1, or 0 per the 2020 design document, which
  is not verified. A penalty also comes from the exam profile.
- An exam that is scored raw, such as a school exam with essays, stays raw.
- Outcomes are score categories 0 to k, so partial credit enters IRT through
  GPCM.
- The older rule, that multiple choice is all or nothing and partial credit is
  only for rubrics, is superseded.

### 5. IRT: the live estimator and the decided design

Live today, in `packages/backend/confect/tryouts/runtime/estimate.ts`:

- A 2PL model with maximum likelihood, solved by Newton steps. At most 25
  iterations run, and each step is limited to plus or minus 1.
- Theta is clamped to plus or minus 4. The standard error is `1 / sqrt(information)`.
- The public score is `500 + 100 × theta`, rounded and clamped to 0 to 1000.
- The estimator uses no prior, and the item parameters are provisional.

Decided, not live:

- EAP with the standard error of the posterior, for binary items. The live
  estimator is maximum likelihood, so EAP is never called live.
- GPCM for categorical items.
- The scale of 500 and 100 is stored per scale version, together with its
  reference population. Today the constants are in code.
- Offline calibration with MML by EM, in resumable chunks. DIF is checked per
  language before scales are linked. Anchors and a minimum sample per item are
  required. An official status comes only after a parameter-recovery test.
- Consumer try-out answers are calibrated after the basis in K2 is met (K12).
- School responses stay out of national calibration unless a school chooses it
  for an exam (K12).
- The public score shows its standard error beside it.
- No official source names the SNBT model. Nakafa uses 2PL by design, and it
  makes no claim of parity with an official scale.

### 6. Exam profiles are part of the country profile

- An exam profile holds the official name per language, the section template,
  the time per section and in total, the navigation, the allowed interactions,
  the tools per section, the accommodation catalogue, the scoring strategy and
  scale, the report form, and the write allowance and reconciliation grace period
  that ADR 0013 reads at the deadline.
- Try-outs and school exams use the same profile type (ADR 0032, K17).
- Aksara signs the profile, and Nakafa checks the signature before it uses the
  profile.
- A number from a profile reaches the product only after its official source is
  reopened and checked.

### 7. Tools and accommodations

- The player's tools form a registry in the design system: a calculator (none,
  basic, scientific, or graphing), a formula sheet, option elimination, a
  highlighter, mark for review, notes, a line reader, zoom, hide time, and text
  to speech.
- The profile and the accommodations switch tools on.
- Level 3 accommodations are frozen when an attempt starts (ADR 0013). Level 1
  can be set at any time.
- The player shows the items as a list, one item at a time, on a phone, or as a
  mirror of the manuscript.
- Adaptive sections move between modules by the rule in the profile.

### 8. Runtime for scale and cost

- A frozen manuscript becomes a signed bundle without answer keys. The bundle is
  a static file with a long cache, named by its hash, so viewing an item reads no
  database.
- An attempt has one row, and each item has one response row. Writes are delayed
  and versioned.
- The offline queue is encrypted per sitting (ADR 0013).
- Deadlines move by scheduled transitions. Submit is idempotent.
- Presence for a proctored sitting uses `@convex-dev/presence`, the one presence
  mechanism that ADR 0013 decides.
- Scores are computed in the workpool.
- The latency figures are the targets in ADR 0013.

### 9. Modules with one owner

The modules live under `packages/backend/confect/assessment`, and each concept
has exactly one owner.

| Module | Owns | Status | Replaces |
| --- | --- | --- | --- |
| `catalog` | Profiles, frozen manuscripts, and signed bundles | Planned | The catalog and the runtime bundle of `confect/tryouts`, wave B |
| `gate` | The attempt cycle, sittings, tokens, devices, deadlines, and answer writes | Planned, wave B | `confect/tryouts/start` and `confect/tryouts/mutations`, wave B |
| `response` | Answer evaluation as pure functions, shared by the client and the server | Live as `confect/response` (#792) | `confect/response` and `confect/tryouts/response`, across waves A and B |
| `scoring` | Raw, penalized, IRT, composite, and report scores | The estimator is live in `confect/tryouts/runtime`. The module is planned. | `confect/tryouts/score` and the estimator, wave B |
| `grading` | The teacher's queue, Nina's suggestions (K6 and K7), and grade release | Planned, new | Nothing |
| `calibration` | Offline IRT, DIF, and scale versions | Planned, wave C. Nothing is stored yet | Keeps and extends the `irtScaleVersions`, `irtScaleItems`, and `irtCalibrationRuns` tables, wave C |
| `analysis` | Item difficulty and discrimination | Planned, new | Nothing |

### 10. Migration without compatibility code

- One major Aksara contract release replaces the 0.x schema. The corpus is
  rewritten or migrated in the same release.
- Nakafa's engine replaces `confect/tryouts` and `confect/response` in one release
  path. No adapter, dual read, or compatibility code sits between the steps.
- A finished attempt is converted once into a frozen result. A running attempt is
  closed and scored first.
- The old try-out functions and the nine `tryout*` tables go in the contract
  step of the rule for public functions (expand, switch, observe, contract,
  `packages/backend/AGENTS.md`): only after production function logs show no
  call to an old try-out function across a window that spans at least one
  production deploy, the check ADR 0011 records for the old School. The 12-hour
  skew window is only a minimum, and a dev dry run comes first.
- One flag table, `assessmentFlags`, holds every assessment flag. No
  `tryoutFlags` table ships.
- Nina reads each question's raw MDX (`packages/backend/confect/nina/focus.ts`).
  That reader moves to the assessment document in the same release.
- No Aksara release may contain short-answer or rubric content until the renderer
  and grading are installed. This is a release gate in wave B.

## Consequences

- An IRT score stays provisional until calibration and a parameter-recovery test
  pass. Its status and its standard error show with it.
- Nakafa makes no parity claim with national exams. Each profile states what is
  verified and what is not.
- A school exam can stay raw, so the item model does not force IRT onto school
  exams.
- Sampled math verdicts reach a teacher in a school exam, never a student's grade
  on their own.
- Finished try-out attempts keep their results as frozen records. They are not
  re-scored.

## Rejected Alternatives

- Compiled MDX as the item body. Code cannot be exported, a school cannot render
  it with its own tools, and Nina reads the rendered text rather than the item.
- A community formula extension (K16).
- Desmos as the graphing calculator. Its commercial API needs a written addendum
  and an approved cost before use. MathVisual builds the graph instead.
- GeoGebra as the graphing calculator for now. No licence for an application API
  has been found, so its vendor must be asked first.
- A second grading model. A second opinion is a second Jev request, made after
  K6 passes and shown only to the teacher.
- Re-scoring finished attempts. Their results are frozen once.
- A parity claim with SNBT, because no official source names the model.

## Implementation Status

| Part | Status |
| --- | --- |
| `packages/backend/confect/tryouts/runtime/estimate.ts` (2PL with maximum likelihood) | Live |
| `packages/backend/confect/response` (#792) | Live |
| The nine `tryout*` tables in `packages/backend/confect/tables` | Live, dropped in wave B |
| The three `irt*` tables in `packages/backend/confect/tables` | Live, extended in wave C |
| `@cortex-js/compute-engine` and `mathlive` | Not installed |
| `@convex-dev/presence` | Not installed. Planned for wave B. |
| `confect/assessment` modules | Planned |
| Assessment document and its compiler | Planned, program wave A |
| `apps/www/components/player` (list or one item, navigator, keys), bound to try-outs | Live. A School binding is planned for wave B. |
| Player tool registry | Planned, program wave B |
| Grading queue and Nina suggestions | Planned, program wave B, after K6 passes |
