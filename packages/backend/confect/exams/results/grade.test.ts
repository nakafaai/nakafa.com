import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  encodeAnswers,
  essayAnswers,
} from "@repo/backend/confect/exams/question";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const results = refs.public.exams.results.results;

/** The device that the test student enters the sitting with. */
const DEVICE = deviceOf(1);

/** The points the essay of the tests is worth. */
const ESSAY_POINTS = 4;

/**
 * A sitting whose one question is an essay worth `ESSAY_POINTS`, which the student has written and
 * submitted, so its answer waits for the teacher.
 */
const submittedEssay = Effect.fn("test.grade.essay")(function* (
  fixture: SittingFixture
) {
  const made = yield* openedSitting(fixture, "Esai");
  const sitting = yield* sittingRow(fixture, made.id);
  const questionId = yield* fixture.run(
    Effect.gen(function* () {
      const exam = yield* (yield* DatabaseReader)
        .table("exams")
        .get(sitting.examId)
        .pipe(Effect.orDie);
      const question = yield* Effect.fromOption(Arr.head(exam.questions));
      yield* (yield* DatabaseWriter)
        .table("examQuestions")
        .patch(question, {
          answers: yield* encodeAnswers(essayAnswers()),
          key: null,
          points: ESSAY_POINTS,
          template: "essay",
        })
        .pipe(Effect.orDie);
      return question;
    })
  );
  yield* enterOk(fixture, {
    deviceId: DEVICE,
    sittingId: made.id,
    token: made.token,
  });
  yield* fixture.as("student").mutation(refs.public.exams.sittings.answer, {
    deviceId: DEVICE,
    questionId,
    response: { text: "Fotosintesis mengubah cahaya menjadi energi kimia." },
    sittingId: made.id,
    slug: nf,
    version: 1,
  });
  yield* fixture.as("student").mutation(refs.public.exams.sittings.finish, {
    deviceId: DEVICE,
    sittingId: made.id,
    slug: nf,
  });
  const row = yield* Effect.fromOption(Arr.head(yield* scoredRows(fixture)));
  return { attemptId: row.attempt, questionId, sittingId: made.id };
});

/** Every scored row of the test database, as the scoring and the grades wrote them. */
const scoredRows = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examResults")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

/** The teacher's grade of one answer. */
const gradeAs = (
  fixture: SittingFixture,
  account: "student" | "teacher",
  args: {
    readonly attemptId: GenericId.GenericId<"examAttempts">;
    readonly points: number;
    readonly questionId: GenericId.GenericId<"examQuestions">;
    readonly sittingId: GenericId.GenericId<"examSittings">;
  }
) => fixture.as(account).mutation(results.grade, { ...args, slug: nf });

describe("exams/results grade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "leaves a written essay pending, and gives it the teacher's points with the verdict they earn, journaling each grade",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const essay = yield* submittedEssay(fixture);
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: 0, verdict: "pending" },
        ]);
        yield* gradeAs(fixture, "teacher", { ...essay, points: 3 });
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: 3, verdict: "partial" },
        ]);
        yield* gradeAs(fixture, "teacher", {
          ...essay,
          points: ESSAY_POINTS,
        });
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: ESSAY_POINTS, verdict: "correct" },
        ]);
        yield* gradeAs(fixture, "teacher", { ...essay, points: 0 });
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: 0, verdict: "incorrect" },
        ]);
        const graded = Arr.filter(
          yield* fixture.run(journal),
          (entry) => entry.change.type === "exam.results.graded"
        );
        expect(Arr.map(graded, (entry) => entry.change)).toEqual([
          {
            attempt: essay.attemptId,
            points: 3,
            question: essay.questionId,
            type: "exam.results.graded",
          },
          {
            attempt: essay.attemptId,
            points: ESSAY_POINTS,
            question: essay.questionId,
            type: "exam.results.graded",
          },
          {
            attempt: essay.attemptId,
            points: 0,
            question: essay.questionId,
            type: "exam.results.graded",
          },
        ]);
      })
  );

  it.effect(
    "refuses more points than the question is worth, an answer the sitting does not hold, and a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const essay = yield* submittedEssay(fixture);
        const above = yield* gradeAs(fixture, "teacher", {
          ...essay,
          points: ESSAY_POINTS + 1,
        }).pipe(Effect.flip);
        expect(above).toMatchObject({ _tag: "PointsAboveWeight" });
        const other = yield* teacherExam(fixture, "Lain");
        const unscored = yield* gradeAs(fixture, "teacher", {
          ...essay,
          points: 1,
          questionId: other.questions[0].id,
        }).pipe(Effect.flip);
        expect(unscored).toMatchObject({ _tag: "ResultNotFound" });
        const student = yield* gradeAs(fixture, "student", {
          ...essay,
          points: 1,
        }).pipe(Effect.flip);
        expect(student).toMatchObject({ _tag: "AccessDenied" });
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: 0, verdict: "pending" },
        ]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examAttempts").delete(essay.attemptId)
          ).pipe(Effect.orDie)
        );
        const gone = yield* gradeAs(fixture, "teacher", {
          ...essay,
          points: 1,
        }).pipe(Effect.flip);
        expect(gone).toMatchObject({ _tag: "ResultNotFound" });
      })
  );
});
