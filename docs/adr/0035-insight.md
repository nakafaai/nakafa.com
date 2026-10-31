# ADR 0035: Insight Predicts For Teachers Only

## Status

Accepted on 18 October 2026, by the orchestrator under the owner's standing
instruction to decide, verify, and record. The owner's decisions K12, K14, K25,
and K6 govern it. The Implementation Status table at the end says which parts are
live.

Amended on 31 October 2026 by the owner's order that nothing waits on a third party:

- **Insight is on in every school.** No DPIA record, no counsel's review, and no refusal stand
  before it. The gate below is gone.
- **The competency key.** No Aksara item and no exam question carries one, so a teacher may
  name the competency of a question (`insightTags`), and a question with none counts for its
  exam, by the exam's title. Nothing guesses a competency from a question's text. Aksara's
  CASE 1.1 keys replace these names when they exist.
- **The rating.** A rating runs from 0 to 1. After an answer that earned `share` of the
  question's points, `rating` moves by `(share - rating) / min(count + 1, 10)`: a plain mean
  for the first ten answers, then a tenth of the way to the latest. One answer writes one
  row. Releasing a sitting's results runs the observations, so a teacher's scored essays
  count, and a release happens once, so an answer counts once.
- **The forecast.** The chance of reaching the KKTP is the share above it of a Beta
  distribution with a uniform prior, updated by the points earned and lost, through its
  normal approximation. Its reason is those points, shown beside it. It is labelled an
  initial estimate until the monthly test exists; that test's threshold is a Brier score of
  0.25, what an even guess scores, so a model must beat a coin.
- **Narratives.** A teacher writes them for now. Nina's draft waits for its provider. The
  teacher's share is enough for a guardian to read one; the student's own share in the
  blueprint waits for shared practice.

## Context

The blueprint's Insight section shows, for each student, the mastery of each
competency and the chance of reaching the KKTP, each with its reasons. The model
prepares predictions and their reasons. Grades, promotion, and any shared narrative
remain the teacher's decisions. A forecast never changes a grade, and it shows only
to teachers.

The blueprint rates grading suggestions and integrity signals as high risk under
AI Act Annex III point 3 (R16). A suggestion is only a suggestion, the teacher
decides, and a DPIA is recorded before launch. Jev may suggest a grade only after
its zero-retention test passes in dev (K6), and until then the teacher grades
alone.

The competency keys do not exist yet. None of the 250 question-bank files in
Aksara carries a competency, and the CP and TP mapping to CASE 1.1 is not built
(ADR 0031 and the blueprint, Mastery). The item blueprint has a `competency`
field in `packages/contracts/src/assessment/item.ts` in Aksara, so the keys can
arrive as content.

## Decision

### Mastery

- Each student has one rating for each competency. The rating changes as each
  answer arrives, from one observation, and it never recalculates the history
  (blueprint, Mastery). The stored row holds the count of observations and the
  rating. Each write updates one row in the same transaction as the answer.
- The competency keys come from Aksara's CASE 1.1 mapping of the school's CP and
  TP. Until a question carries its key, it adds no observation, and Insight shows
  no rating for it. Insight does not guess a key from the text of a question.
- The rating's formula is not in the blueprint. It is an open decision that the
  owner settles before S12 ships. No rating is shown until its formula is recorded
  in an amendment to this ADR.
- The mastery numbers are not sealed, because they are computed. Narratives are
  sealed under the school key (ADR 0030, and the retention table of ADR 0033).

### Forecast

- A forecast is the chance that a student reaches the KKTP in a competency, with
  the observations that drive it as its reasons. The model only prepares the
  prediction and its reasons (blueprint, Insight).
- A forecast never changes a grade and never leaves the teacher's screen. The
  Counselor (Guru BK) reads insight (ADR 0012), so teachers and the Counselor are
  the only readers.
- Each forecast is explained on request. A forecast with no reasons is not shown.
- Forecast accuracy is compared with the real results every month. A new model
  replaces the old one only after it passes that test (blueprint, Insight
  calibration). The test is a proper scoring rule, such as the Brier score, and its
  acceptance threshold is an open decision for the owner. The threshold is not in
  the blueprint, and S13 does not ship a forecast before it is set.
- Item difficulty is labelled an initial estimate until the IRT calibration passes
  (ADR 0031, and the blueprint's calibration rule).
- A teacher's intervention is recorded as descriptive evidence, never as a cause.

### Sources

- Insight reads graded school tasks and school exams, and nothing else by default.
- A student's private practice enters only when the student shares it, per topic,
  and the student can revoke the share at any time (the Shared practice relation,
  ADR 0012).
- Classroom and Calendar data enter only when the student allows the connector
  (ADR 0015).
- Private Nina conversations never enter (blueprint, Insight sources).
- Nina drafts a narrative for the homeroom teacher. The teacher approves it and
  shares it, and the share can be withdrawn from the same page (blueprint, Narasi
  and K3).

### Limits that always apply

- No automatic decision with an effect is made, and an explanation is always
  available (blueprint, Insight rules).
- An integrity report only indicates to the teacher and never changes a grade
  (K25). It uses no camera, face, voice, or emotion inference (K14).
- School exam results are not used for a national scale calibration unless the
  school chooses it for each exam (K12).
- Item difficulty and mastery do not decide a student's placement, promotion, or
  report. The teacher decides each of them (ADR 0033, Report cards).

### Retention

- Mastery numbers are kept during the school year and deleted with the period
  (blueprint, privacy table).
- Narratives are kept during the school year, sealed, and deleted with the period.
- Forecasts are derived. They are kept during the school year and deleted with the
  period, with their reasons.
- A school's end removes all of them after an export, 30 days after it leaves (ADR
  0033, Retention).

## Consequences

- Teachers see more than they did, and the explanation is always attached. A
  teacher can see why a forecast is what it is, and can reject it.
- Mastery starts from the first released exam, by the exam's title, and sharpens as
  teachers name competencies and Aksara's keys arrive.

## Rejected Alternatives

- A forecast that changes the default grade or the promotion suggestion. The
  blueprint forbids it, and the teacher's decision stays with the teacher.
- A forecast for students or guardians. Only teachers and the Counselor read it.
- A competency guessed from the question text. The key comes from the content,
  and no word list or regular expression decides it.
- Recalculating the whole history on each answer. The rating updates from one
  observation, so a write stays one row.
- A model before its calibration test. A new model is used only after it passes
  the monthly check.

## What Stays Open

- The mastery formula and its recorded amendment (owner, before S12).
- The forecast's acceptance threshold for the monthly test (owner, before S13).
- The provider of Nina's narrative drafts, and whether the K6 gate applies to
  them. The blueprint does not state either.

## Implementation Status

| Part | Status |
| --- | --- |
| The decisions in this ADR | Recorded by S0 |
| Competency keys in Aksara content (CASE 1.1 mapping) | Planned, Aksara work first |
| Competency tags typed by the teacher (`insightTags`) | Built |
| Mastery rows (`insightMastery`), written when a sitting's results are released | Built |
| Forecasts and their reasons, computed when read | Built, as an initial estimate; the monthly test is planned |
| Insight screens for teachers and students, and teachers' narratives for guardians | Built |
| Shared practice, Nina's narrative drafts, deletion with the period | Planned |
