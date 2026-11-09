# ADR 0046: One Assessment Engine With Two Ports

## Status

Accepted on 9 November 2026. It records how program wave B of ADR 0031 is cut: where the seam of the assessment engine lies, which tables the engine owns, and the order of the changes. It amends ADR 0031 section 9 (modules) and section 10 (the cutover), and it keeps ADR 0044 (practice keeps its own records).

## Context

Measured on main `7561978b7f` on 9 November 2026:

| Concern | Try-out | School sitting | Shared today |
| --- | --- | --- | --- |
| Admission of a write | the store `tryouts/gate.ts` (391 lines) | the store `exams/sittings/gate.ts` (286 lines) | the guard sequence `assessment/gate/admit.ts` over a `Store` |
| Attempt rows | `tryoutAttempts`, `tryoutSectionAttempts`, `tryoutAttemptPlacements`, `tryoutResponses`, `tryoutScores`, `tryoutSetProgress` | `examAttempts`, `examAnswers`, `examResults` | `assessmentFlags` |
| Deadlines | cron `sweep try-out expiry` every 5 minutes, `tryouts/deadline.ts`, one job per attempt and per section | cron `sweep late sitting steps` every minute, `exams/sittings/sweep.ts`, `closing.ts`, `timers.ts` | `isDue` and `sweepOverdue` in `assessment/gate/deadline.ts` |
| Grading an answer | at write time (`tryouts/response/answer.ts:44`) | at submit (`exams/results/score.ts:52`) | `grade` in `assessment/grade.ts` |
| Scoring | `tryouts/runtime/{finish,score,result,irt,estimate}.ts` and kin, 971 lines | `exams/results/{record,score}.ts` | none: the correct test, the counts and the point share are written twice, one rounding up and one down |
| Client answers | `components/tryout/runtime/response/*` | `components/exams/sitting/*` | nine pairs of the same functions: next version, optimistic apply, keep, send, resend, refusal, toast |
| Seconds left | `tryout/player/timer.tsx:9`, `tryout/runtime/countdown.tsx:24` | `exams/sitting/attempt.ts:15` | none |
| Review and results | `components/tryout/review` (646 lines) | `components/exams/results` (2,078 lines) | the Player's question kinds (ADR 0043) |

Admission is already one engine with two stores, and the question kinds are already one Player with two adapters. Everything between them, the rows of a run, its clock, its score and its review, is written twice. A rule or a bug fixed in one program stays in the other, and the owner requires try-out, exam sitting, School and consumer to share one experience with zero differences.

Practice (ADR 0044, #2276) adds a third copy of a frozen paper and graded answers in `practiceQuestions` and `practiceAnswers`, built on the try-out freeze and `gradeAnswer`.

### What any engine must satisfy

1. **Who.** A consumer try-out belongs to a user. A sitting belongs to a Person of a tenant, and every school row is reachable by its tenant, so a school's data can be listed, exported and deleted as one (ADR 0011, ADR 0026).
2. **Paper.** A try-out freezes its paper when the attempt starts, from signed Aksara item versions named by hash, with keys that never leave the server before review. A sitting's paper follows the exam while the exam takes changes and freezes when its first sitting closes (owner, 30 October 2026, ADR 0031 implementation status).
3. **Clock.** A try-out has several sections, each with its own limit, inside the attempt's window. A sitting has one clock, the room's close, moved only by a proctor's added minutes, then a closing state and a submit 75 seconds later, with a 15 second write allowance.
4. **Score.** A try-out scores by its profile's strategy (`raw`, `penalized`, `irt` with scale versions and a standard error). A sitting scores points per question by its rule, a teacher grades what is pending, and an admin releases the results.
5. **Review.** A try-out shows its review when a section ends, with keys and explanations for Pro and for two free samples. A sitting shows a student's results only after release, without keys.
6. **Data.** No migration, backfill or dual read ships (ADR 0031 section 10, `packages/backend/AGENTS.md`). Try-out runtime rows are learner records that ADR 0031 allows to reset per program, and the owner's decision D31 emptied them on 9 November at 02:57 CET. School rows are cleared only with the owner's approval.
7. **Cost.** Every read stays bounded by the questions of one attempt or one page of one index.

## Decision

### D1. The seam: one engine, two ports

The engine is `packages/backend/confect/assessment`. It owns every rule of a run: the attempt and its section clocks, admission (the existing gate), answer storage, the deadline steps and the one sweep, grading, the result rows, scoring by strategy, and the review projection. Two things vary across the programs, and each is a port with two adapters:

| Port | Asks | Adapters |
| --- | --- | --- |
| `Paper` | the placements of a section, and one placement's question: interaction, key, rule, points | `item`: frozen item versions of a signed snapshot, stored in `assessmentPlacements` (try-out, practice). `question`: a school exam's `examQuestions` row, live until `exams.frozenAt` (sitting). |
| `Program` | the policy (write allowance, device binding, closing delay, release, strategy), who may read an attempt and what its review reveals, and what happens once an attempt ends | `tryout`: set progress by index, island awards, reminder cancel, Pro and sample reveal. `sitting`: proctor lock and devices, the journal, integrity, release by an admin. |

A program is data on the attempt (D2), so the engine selects its adapter by `Match` on the attempt's program kind, from one record of adapters. No caller passes an adapter, and no engine function takes a program's type parameters.

### D2. The engine's tables

| Table | One row per | Holds |
| --- | --- | --- |
| `assessmentAttempts` | attempt | `program`, a tagged union that carries the owner: `{ kind: "tryout", user, set, locale, access, number, competition, paper, profile, snapshot }` or `{ kind: "sitting", tenant, person, sitting }`; the device binding; the state; the attempt deadline; `due`, the time of its next deadline step; the sections inline, each with its key, order, limit, start, deadline, state and end reason; the frozen strategy; the score once ended |
| `assessmentPlacements` | frozen question of an item paper | the item version by family and hash, the delivery language, the interaction and key as JSON text, the rule, the section and order |
| `assessmentAnswers` | answered placement | the placement (`{ kind: "item", placement }` or `{ kind: "question", question }`), the response, its version, when it was answered. A clear stores the empty response with its version, so no cleared version is kept elsewhere |
| `assessmentResults` | scored placement | the verdict, the category and ceiling, the points, the response it scored, and where it was asked (`{ kind: "item", family, versionHash }` or `{ kind: "sitting", sitting, question }`), written when a section ends |

- The owner sits inside the program, so a try-out with a tenant or a sitting without one cannot be written. Nested indexes read it (`program.user`, `program.tenant`, `program.sitting`, `program.person`), as `journalEntries` reads `owner.tenantId`. A sitting's answers and results are reached through its attempt, so a school's rows stay listable by its tenant without a tenant field on every row; on main no reader takes `examAnswers` or `examResults` by tenant.
- `due` gives the sweep one index for every program and every step (`by_state_and_due`): a section's expiry, an attempt's expiry, and a closing attempt's submit. One cron, `sweep assessment deadlines`, runs every minute through `sweepOverdue`, with the sitting's own open and close kinds beside it.
- Set progress is read from `assessmentAttempts` by owner, set and start time, first row, so `tryoutSetProgress` goes without a replacement.
- `irtScaleVersions`, `irtScaleItems` and `irtCalibrationRuns` stay, owned by the scoring module and extended in wave C.
- `examSittings`, `examSignals`, `examScreens`, `examQuestions` and `exams` stay School's: they are the sitting's context, not its run.

### D3. The engine's interface

```ts
// confect/assessment: the whole interface a program and the web see
begin(program, paper)                 // the attempt, its sections and frozen placements, its first deadline step
open(owner, attempt, section)          // starts a section's clock (a sitting opens its one section at entry)
answer(owner, device, placement, response, version)
finish(owner, device, attempt, section, settled)  // ends the section; the last one ends and scores the attempt
step(attempt, due)                     // the scheduled deadline step, sent again by the sweep
run(owner, attempt)                    // the live state the Player draws
review(viewer, attempt)                // results and what the program reveals
```

Every failure is a tagged error of the gate (`AttemptRefused`, `Stale`) or of a port, mapped once per program at its function boundary, as the gate's stores map them today.

### D4. The client: one answer ledger and one clock in the Player

The Player owns the answer ledger (next version, optimistic apply, keep, send with the network retry, resend on mount, refusal and its toast), the finish keep, and `secondsLeft`. Each program binds it with its Convex references, as it binds the question kinds (ADR 0043). The try-out and sitting copies are deleted.

### D5. Review: one projection, one set of parts

`review` returns every placement's result in order with the reveal its program allows, and the Player's review parts draw it: the verdict list, the score summary, the question with the learner's answer and, when revealed, the key. The try-out review and a student's School results compose them; the teacher's results tables stay School's.

### D6. Practice stays its own records

ADR 0044 holds: a practice session is not an attempt, so no reader of attempts filters it out. Practice uses the engine's `item` paper to freeze its section and the engine's grading to check a question, so neither the freeze nor the grading is written twice.

### D7. The order of the changes, one stack

| Step | Change | Starts when |
| --- | --- | --- |
| 1 | This ADR and the glossary terms | now |
| 2 | The engine's tables and modules with the `item` paper and the `tryout` program; the try-out functions and pages read them; `confect/tryouts` keeps only the catalog, sets, access and routes; the six try-out runtime tables, the try-out store, its sweep and its scoring are deleted | the open try-out PRs (#2258, #2271, #2276, #2279, #2285, #2301, #2310, #2318) are on main, and the try-out runtime rows written since the D31 reset are cleared on production with the Convex CLI right before the deploy |
| 3 | The Player's answer ledger and clock (D4), bound by try-out and the sitting; both copies deleted | step 2 is on main |
| 4 | The review projection and parts (D5) | step 3 is on main |
| 5 | The `question` paper and the `sitting` program; sittings read and write the engine's tables; `examAttempts`, `examAnswers` and `examResults`, the sitting store, its sweep kinds for attempts and `exams/results/{record,score}.ts` are deleted; Insight (`insight/observe.impl.ts`) reads `assessmentResults` | step 4 is on main, the School lane has agreed the change, and a bounded count reads no rows in those three tables on production or the owner approves their disposal |

Each step deletes the path it makes unused in the same change. No step keeps an adapter between the old and the new tables.

## Considered Designs

The interface was designed three ways before this choice.

**A. One run, programs as data.** Five entry points, every program a value on the attempt, and every paper frozen at the start. It is the deepest interface, but it breaks the sitting's live paper (constraint 2), and the proctor rules become conditionals inside one implementation instead of an adapter's policy.

**B. Engine algorithms over program stores.** Today's gate `Store` widened to the whole run: each program keeps its tables and implements about twelve store methods (load the attempt, the section and the placement, write the answer, end the section, write the result, page the overdue rows). It keeps School's rows where they are, but the interface is nearly as large as what it hides, two storage implementations stay, and the try-out tables only change their names.

**C. One engine, two ports (chosen).** A's storage and entry points, with the two things that really vary across programs, the paper's source and the program's policy, behind ports with two adapters each. The interface stays small, every rule has one implementation, and each port has two real adapters.

## Consequences

- Step 2 deletes the try-out lifecycle, 5,618 lines of source and 2,851 lines of tests on `7561978b7f` (`start`, `runtime`, `response`, `mutations`, `score`, the store, the sweep and their kin), and the engine's modules replace it. `confect/tryouts` keeps the catalog, sets, access, queries and routes, 2,402 lines. Step 5 deletes the sitting's store, its attempt sweep kinds and its scoring.
- A rule of a run (admission, a deadline, a score, a reveal) is fixed once and holds for try-out, School and the SNBT, TKA and German programs at once.
- Tests cross the engine's interface with an in-memory paper and program, so each port's adapter is tested alone and the engine's rules once.
- One cron replaces two, and the sweep reads one index.
- Finished try-out attempts are not converted: the try-out runtime rows are reset as ADR 0031 allows. Finished School attempts are never touched without the owner's approval.

## Rejected Alternatives

- Practice as a mode of the attempt, rejected by ADR 0044 for the reason it gives.
- A shared `owner` field beside the program, which would let a try-out carry a tenant.
- Freezing a sitting's paper at entry, which the owner's 30 October decision rules out.
- Moving School first: its rows may hold a school's records, so the try-out cutover goes first and never touches them.
