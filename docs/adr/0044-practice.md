# ADR 0044: Practice Beside The Try-out

## Status

Accepted on 8 November 2026, from the owner's decisions D1, D2, D5 and D6 of the Nakafa Consumer plan.

## Context

A try-out runs like the real exam: a timer per section, a 24-hour window, sections in order, and a score that feeds the official scale and its calibration (IRT). Learners also want to work through the same questions without a clock: answer one, check it at once, read why, ask Nina, and come back later. The owner decided on 8 November that this practice mode, Latihan, stands beside the try-out on every set, has no timer and no window, checks each question on its own, shows the explanation inline for Pro, lets everyone ask Nina from a question for the usual Nina credits (D1: a free learner has 10 a day, one answer costs 5), and never enters the official score or the calibration (D5).

## Decision

**Its own records.** Practice keeps three tables of its own in `confect/practice`, never a mode of `tryoutAttempts`. A try-out attempt carries a deadline, timed sections, a scale version, access for competitions and a score; none of them applies to practice, and every reader of attempts (scores, history, catalog progress, deadlines, calibration, reminders) would otherwise have to filter practice out. Keeping practice apart keeps it out of the score and the calibration by construction.

| Table | Holds |
| --- | --- |
| `practiceSessions` | One per learner, set and section: the snapshot and release it froze from, its paper, its locale, and when it started and was last used. |
| `practiceQuestions` | The section's questions frozen when the session started, as a try-out's placements are: item version, interaction and key as JSON text, the scoring rule, the order. |
| `practiceAnswers` | One per checked question: the response, its grade and when it was checked. |

**One freeze.** A session freezes its section exactly as a try-out start does: `loadTryoutStartSource` reads the set, its paper, its profile and every item from the active snapshot, and `freezeAttempt` builds the places, of which the session keeps its section's. The question bodies are read by `readSectionBodies` from the frozen rows, so a later release never changes a session mid-way.

**Check, then final.** A question is answered and checked in one step (`practice.mutations.check`): the server grades the response with the frozen interaction, key and rule (`gradeAnswer`, the try-out's own) and stores it, and the question is final for that session. Every learner sees the verdict at once. A Pro learner also sees the key marked and the explanation under the question; any other learner sees them on the section's two free samples only (D2), and the Pro offer in the explanation's place elsewhere. Starting again clears the session's answers and freezes the section anew when the active release changed.

**No clock, any order.** Practice uses the shared player (`PlayerProvider`): the list or one question at a time, the address naming the current question, previous and next, and no timer, finish or deadline. A learner leaves and comes back to the same session with its checked questions.

**Nina for everyone.** Asking Nina about a practice question, or about a question of a reviewed try-out, is open to every learner and spends Nina credits as any answer does (D1). Nina reads the question, the learner's answer and its verdict, and the explanation.

**Islands.** The world lane awards Stars through its own seam (`island/award.ts`, ADR 0042). Practice records each first correct check, so the island can award it once that seam lands, without practice reading island code.

## Consequences

- The official score, the scale and the calibration never read a practice answer.
- A set page offers both: the timed try-out, and Latihan, which resumes where the learner stopped.
- A practice session grows with checked questions only, at most one answer per question, so its reads stay bounded by the section's question count.
- A session holds the snapshot it froze from as an attempt does (`contentRelease/snapshot/retention.ts`), so its questions stay readable until the learner starts again, which freezes the active release.
