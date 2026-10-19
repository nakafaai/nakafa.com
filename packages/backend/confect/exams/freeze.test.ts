import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  freezeExam,
  requireUnfrozen,
} from "@repo/backend/confect/exams/freeze";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { open } = refs.public.exams.exams;
const { add, answer, copy, move, remove } = refs.public.exams.questions;

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
});
