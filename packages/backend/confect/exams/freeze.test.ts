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
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { open } = refs.public.exams.exams;
const { add, answer, copy, move, remove } = refs.public.exams.questions;
const { submit } = refs.public.editor.steps;

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
    "freezes an exam at the time of its first schedule, and keeps that time",
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
        yield* fixture.run(freezeExam(unfrozen));
        expect((yield* row()).frozenAt).toBe(TENANCY_NOW);
        vi.setSystemTime(TENANCY_NOW + 60_000);
        yield* fixture.run(freezeExam(yield* row()));
        expect((yield* row()).frozenAt).toBe(TENANCY_NOW);
      })
  );

  it.effect(
    "refuses every change to the questions of an exam once a sitting of it is scheduled, and changes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
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
        expect(yield* teacher.query(open, { examId, slug: nf })).toEqual(
          before
        );
      })
  );

  it.effect(
    "returns the time an exam froze, once a sitting of it is scheduled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ujian");
        const before = yield* teacher.query(open, { examId, slug: nf });
        expect(before.frozenAt).toBeUndefined();
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const after = yield* teacher.query(open, { examId, slug: nf });
        expect(after.frozenAt).toBe(TENANCY_NOW);
      })
  );

  it.effect(
    "lets a step push to the prompt of an exam that no sitting has scheduled",
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
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
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
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
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
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
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
