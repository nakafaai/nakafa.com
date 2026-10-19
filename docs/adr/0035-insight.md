# ADR 0035: Insight Predicts For Teachers Only, And Switches On Per School After A DPIA

## Status

Accepted on 18 October 2026, by the orchestrator under the owner's standing
instruction to decide, verify, and record. The owner's decisions K12, K14, K25,
and K6 govern it, and counsel reviews the data protection impact assessment (K20)
before the first school. Insight waits for the assessment engine switch (ADR 0031,
wave B) and for the school grades of ADR 0033. The Implementation Status table at
the end says which parts are live.

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

### The DPIA gate

- Insight is off in a school until the school's DPIA is recorded. The DPIA record
  holds its version, its date, the reviewer, and the modules it switches on, and
  Settings shows it under Security, as the blueprint's DPIA card (ADR 0027 and the
  settings structure of `apps/www/lib/settings/school.ts`).
- The gate is a Condition in access (ADR 0012), so `insight.view` is refused with
  its reason while no DPIA is recorded. It is not a flag in the UI. The UI reads
  the refusal from the viewer's capabilities (GLOSSARY, Viewer capabilities).
- Changing the DPIA is a journaled change. A school can relax its quiet hours only
  as its DPIA allows (ADR 0027).
- Nothing in the repository stores a DPIA today. S12 adds the record, and no
  Insight screen ships before it.

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
- An Insight screen cannot appear in a school without a recorded DPIA, because the
  refusal comes from the access layer, not from the page.
- Competency keys from Aksara become a condition of mastery. Until they exist,
  Insight is empty by design, and the empty state says so in one sentence.

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
- The DPIA's review by counsel before the first school (K20).

## Implementation Status

| Part | Status |
| --- | --- |
| The decisions in this ADR | Recorded by S0 |
| Competency keys in Aksara content (CASE 1.1 mapping) | Planned, Aksara work first |
| Mastery rows (`mastery`) | Planned, S12 |
| Forecast rows and their reasons | Planned, S13 |
| The DPIA record and its Condition in access | Planned, S12 |
| Insight screens, shared practice, and narratives | Planned, S14 |
