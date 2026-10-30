import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  freezeExam,
  requireUnfrozen,
} from "@repo/backend/confect/exams/freeze";
import {
  batchText,
  documentRowOf,
  newDocument,
  nf,
  stepRows,
} from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
} from "@repo/backend/test/sittings";
import {
  actedAt,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { open } = refs.public.exams.exams;
const { add, answer, copy, move, points, remove } = refs.public.exams.questions;
const { submit } = refs.public.editor.steps;
const { closeDue } = refs.internal.exams.sittings.timers;

/** Schedules a unit sitting of the exam and closes it, as the scheduler does at its closing time, which finishes it. */
const finishSitting = Effect.fn("test.freeze.finish")(function* (
  fixture: Parameters<typeof scheduleSitting>[0],
  examId: Parameters<typeof scheduleSitting>[1]["examId"]
) {
  const made = yield* scheduleSitting(fixture, {
    closesAt: CLOSES_AT,
    examId,
    group: { kind: "unit", unitId: fixture.units.smp },
    opensAt: OPENS_AT,
  });
  yield* fixture.internal.mutation(closeDue, {
    atDeadline: "now",
    sittingId: made.id,
  });
});

describe("exams/freeze", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.effect("lets a change through while no sitting has frozen the exam", () =>
    requireUnfrozen({})
  );

  it.effect("refuses a change to an exam that a sitting froze", () =>
    Effect.gen(function* () {
      expect(
        yield* requireUnfrozen({ frozenAt: TENANCY_NOW }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ExamFrozen" });
    })
  );

  it.effect(
    "freezes an exam at the time of its first close, and keeps that time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Ujian");
        const row = () =>
          fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader.table("exams").get(exam.id).pipe(Effect.orDie)
            )
          );
        const unfrozen = yield* row();
        expect(unfrozen.frozenAt).toBeUndefined();
        vi.setSystemTime(actedAt(0));
        yield* fixture.run(freezeExam(unfrozen));
        expect((yield* row()).frozenAt).toBe(actedAt(0));
        vi.setSystemTime(actedAt(60));
        yield* fixture.run(freezeExam(yield* row()));
        expect((yield* row()).frozenAt).toBe(actedAt(0));
      })
  );

  it.effect(
    "takes a change to the questions while a sitting is scheduled and while it runs",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const teacher = fixture.as("teacher");
        const [first] = (yield* teacher.query(open, { examId, slug: nf }))
          .questions;
        yield* teacher.mutation(points, {
          examId,
          points: 2,
          questionId: first.id,
          slug: nf,
        });
        vi.setSystemTime(OPENS_AT);
        yield* fixture.internal.mutation(
          refs.internal.exams.sittings.timers.open,
          { sittingId: made.id }
        );
        yield* teacher.mutation(points, {
          examId,
          points: 3,
          questionId: first.id,
          slug: nf,
        });
        const running = yield* teacher.query(open, { examId, slug: nf });
        expect(running.frozenAt).toBeUndefined();
        expect(running.questions[0]?.points).toBe(3);
      })
  );

  it.effect(
    "refuses every change to the questions of an exam once a sitting of it has finished, and changes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        yield* finishSitting(fixture, examId);
        const teacher = fixture.as("teacher");
        const before = yield* teacher.query(open, { examId, slug: nf });
        const [first] = before.questions;
        expect(
          yield* teacher
            .mutation(add, { after: first.id, examId, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(
          yield* teacher
            .mutation(copy, { examId, questionId: first.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(
          yield* teacher
            .mutation(remove, { examId, questionId: first.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(
          yield* teacher
            .mutation(move, {
              examId,
              index: 0,
              questionId: first.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(
          yield* teacher
            .mutation(answer, {
              answers: first.answers,
              examId,
              key: null,
              questionId: first.id,
              revision: first.revision,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(
          yield* teacher
            .mutation(points, {
              examId,
              points: 2,
              questionId: first.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen" });
        expect(yield* teacher.query(open, { examId, slug: nf })).toEqual(
          before
        );
      })
  );

  it.effect(
    "refuses an edit of the rubric and the explanation of a question once a sitting of its exam has finished",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const teacher = fixture.as("teacher");
        const [first] = (yield* teacher.query(open, { examId, slug: nf }))
          .questions;
        yield* finishSitting(fixture, examId);
        const refused = yield* Effect.forEach(
          [first.rubric, first.explanation],
          (documentId) =>
            batchText(0, "rina", 1).pipe(
              Effect.flatMap((batch) =>
                teacher.mutation(submit, { batch, documentId, slug: nf })
              ),
              Effect.flip
            )
        );
        expect(refused).toMatchObject([
          { _tag: "ExamFrozen" },
          { _tag: "ExamFrozen" },
        ]);
      })
  );

  it.effect(
    "leaves a scheduled exam unfrozen, and returns the time it froze once its sitting closes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const scheduled = yield* teacher.query(open, { examId, slug: nf });
        expect(scheduled.frozenAt).toBeUndefined();
        vi.setSystemTime(actedAt());
        yield* fixture.internal.mutation(closeDue, {
          atDeadline: "now",
          sittingId: made.id,
        });
        const finished = yield* teacher.query(open, { examId, slug: nf });
        expect(finished.frozenAt).toBe(actedAt());
      })
  );

  it.effect(
    "lets a step push to the prompt of an exam that no sitting has finished",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Terbuka");
        const [first] = exam.questions;
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId: first.prompt,
          slug: nf,
        });
        expect((yield* fixture.run(documentRowOf(first.prompt))).head).toBe(2);
      })
  );

  it.effect(
    "refuses a step push to the prompt of a frozen exam, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const opened = yield* teacher.query(open, { examId, slug: nf });
        const [first] = opened.questions;
        yield* finishSitting(fixture, examId);
        expect(
          yield* teacher
            .mutation(submit, {
              batch: yield* batchText(0, "rina", 2),
              documentId: first.prompt,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ExamFrozen", code: "EXAM_FROZEN" });
        expect((yield* fixture.run(documentRowOf(first.prompt))).head).toBe(0);
        const steps = yield* fixture.run(stepRows);
        expect(
          Arr.filter(steps, (step) => step.documentId === first.prompt)
        ).toEqual([]);
      })
  );

  it.effect(
    "answers a batch the session sent before the freeze with nothing, as a retried batch is answered",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const opened = yield* teacher.query(open, { examId, slug: nf });
        const [first] = opened.questions;
        const text = yield* batchText(0, "rina", 2);
        yield* teacher.mutation(submit, {
          batch: text,
          documentId: first.prompt,
          slug: nf,
        });
        yield* finishSitting(fixture, examId);
        expect(
          yield* teacher.mutation(submit, {
            batch: text,
            documentId: first.prompt,
            slug: nf,
          })
        ).toBeNull();
        const steps = yield* fixture.run(stepRows);
        expect(
          Arr.filter(steps, (step) => step.documentId === first.prompt)
        ).toHaveLength(2);
      })
  );

  it.effect(
    "lets a change to a document that is no exam's prompt through, while an exam is frozen",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        yield* finishSitting(fixture, examId);
        const documentId = yield* newDocument(fixture);
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId,
          slug: nf,
        });
        expect((yield* fixture.run(documentRowOf(documentId))).head).toBe(2);
      })
  );
});
