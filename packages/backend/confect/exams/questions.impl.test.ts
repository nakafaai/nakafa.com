import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { denied, documentRows, nf } from "@repo/backend/test/editor";
import {
  archiveUnit,
  fillExam,
  questionRows,
  teacherExam,
} from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, HashSet } from "effect";

const { create, open } = refs.public.exams.exams;
const { add, answer, copy, move, points, remove } = refs.public.exams.questions;

describe("exams/questions", () => {
  it.effect(
    "adds a question after the one it names, with the default points and its prompt, rubric, and explanation documents",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Ujian");
        const [first] = exam.questions;
        const added = yield* fixture.as("teacher").mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        expect(added).toMatchObject({
          key: null,
          points: 1,
          revision: 0,
          template: "choice",
        });
        expect(
          HashSet.size(
            HashSet.make(added.prompt, added.rubric, added.explanation)
          )
        ).toBe(3);
        const opened = yield* fixture.as("teacher").query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(Arr.map(opened.questions, (question) => question.id)).toEqual([
          first.id,
          added.id,
        ]);
        expect(yield* fixture.run(documentRows)).toHaveLength(6);
      })
  );

  it.effect(
    "refuses a question past the limit of an exam, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Penuh");
        const [first] = exam.questions;
        yield* fixture.run(fillExam(exam.id, first.id, MAX_EXAM_QUESTIONS));
        const failure = yield* fixture
          .as("teacher")
          .mutation(add, { after: null, examId: exam.id, slug: nf })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ExamFull", code: "EXAM_FULL" });
        expect(yield* fixture.run(questionRows)).toHaveLength(
          MAX_EXAM_QUESTIONS
        );
        expect(yield* fixture.run(documentRows)).toHaveLength(3);
      })
  );

  it.effect(
    "refuses to place a question after a question of another exam, as a missing object",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const mine = yield* teacherExam(fixture, "Milik saya");
        const theirs = yield* teacherExam(fixture, "Milik lain");
        const [foreign] = theirs.questions;
        const failure = yield* fixture
          .as("teacher")
          .mutation(add, { after: foreign.id, examId: mine.id, slug: nf })
          .pipe(Effect.flip);
        expect(failure).toMatchObject(denied("resource"));
        expect(yield* fixture.run(questionRows)).toHaveLength(2);
      })
  );

  it.effect(
    "moves a question to an index, keeps every question once, and places an index past the end last",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Urutan");
        const [first] = exam.questions;
        const second = yield* teacher.mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        const third = yield* teacher.mutation(add, {
          after: second.id,
          examId: exam.id,
          slug: nf,
        });
        const toEnd = yield* teacher.mutation(move, {
          examId: exam.id,
          index: 2,
          questionId: first.id,
          slug: nf,
        });
        expect(toEnd.questions).toEqual([second.id, third.id, first.id]);
        const toStart = yield* teacher.mutation(move, {
          examId: exam.id,
          index: 0,
          questionId: third.id,
          slug: nf,
        });
        expect(toStart.questions).toEqual([third.id, second.id, first.id]);
        const pastEnd = yield* teacher.mutation(move, {
          examId: exam.id,
          index: 99,
          questionId: second.id,
          slug: nf,
        });
        expect(pastEnd.questions).toEqual([third.id, first.id, second.id]);
      })
  );

  it.effect("keeps every question once when two moves are made at once", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const exam = yield* teacherExam(fixture, "Serentak");
      const [first] = exam.questions;
      const second = yield* teacher.mutation(add, {
        after: first.id,
        examId: exam.id,
        slug: nf,
      });
      const third = yield* teacher.mutation(add, {
        after: second.id,
        examId: exam.id,
        slug: nf,
      });
      yield* Effect.all(
        [
          teacher.mutation(move, {
            examId: exam.id,
            index: 1,
            questionId: first.id,
            slug: nf,
          }),
          teacher.mutation(move, {
            examId: exam.id,
            index: 1,
            questionId: third.id,
            slug: nf,
          }),
        ],
        { concurrency: "unbounded" }
      );
      const opened = yield* teacher.query(open, {
        examId: exam.id,
        slug: nf,
      });
      // Applied one after the other, the two moves give one of these two orders, and never a question lost or doubled.
      expect([
        [second.id, third.id, first.id],
        [third.id, first.id, second.id],
      ]).toContainEqual(Arr.map(opened.questions, (question) => question.id));
    })
  );

  it.effect(
    "refuses a question of another exam as a missing object for every operation on it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const mine = yield* teacherExam(fixture, "Milik saya");
        const theirs = yield* teacherExam(fixture, "Milik lain");
        const [foreign] = theirs.questions;
        const refusals = yield* Effect.all([
          teacher
            .mutation(copy, {
              examId: mine.id,
              questionId: foreign.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(remove, {
              examId: mine.id,
              questionId: foreign.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(move, {
              examId: mine.id,
              index: 0,
              questionId: foreign.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(answer, {
              answers: foreign.answers,
              examId: mine.id,
              key: null,
              questionId: foreign.id,
              revision: 0,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(points, {
              examId: mine.id,
              points: 3,
              questionId: foreign.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
          denied("resource"),
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect(
    "lets an Admin of the school and an Admin of the unit change the questions of a teacher's exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Admin");
        const [first] = exam.questions;
        const added = yield* fixture.as("admin").mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        const copied = yield* fixture.as("unitAdmin").mutation(copy, {
          examId: exam.id,
          questionId: added.id,
          slug: nf,
        });
        const opened = yield* fixture.as("admin").query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(Arr.map(opened.questions, (question) => question.id)).toEqual([
          first.id,
          added.id,
          copied.id,
        ]);
      })
  );

  it.effect(
    "refuses every change to an exam of an archived unit, and writes nothing, though the exam stays readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Arsip");
        const [first] = exam.questions;
        const second = yield* teacher.mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        yield* fixture.run(archiveUnit(fixture.units.smp));
        const refusals = yield* Effect.all([
          teacher
            .mutation(add, { after: null, examId: exam.id, slug: nf })
            .pipe(Effect.flip),
          teacher
            .mutation(copy, { examId: exam.id, questionId: first.id, slug: nf })
            .pipe(Effect.flip),
          teacher
            .mutation(remove, {
              examId: exam.id,
              questionId: first.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(move, {
              examId: exam.id,
              index: 1,
              questionId: first.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(answer, {
              answers: first.answers,
              examId: exam.id,
              key: null,
              questionId: first.id,
              revision: 0,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(points, {
              examId: exam.id,
              points: 3,
              questionId: first.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("condition"),
          denied("condition"),
          denied("condition"),
          denied("condition"),
          denied("condition"),
          denied("condition"),
        ]);
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(Arr.map(opened.questions, (question) => question.id)).toEqual([
          first.id,
          second.id,
        ]);
        expect(yield* fixture.run(questionRows)).toHaveLength(2);
      })
  );

  it.effect(
    "refuses a student who adds a question, and a teacher who changes a question of another unit, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const mine = yield* teacherExam(fixture, "Milik saya");
        const [mineFirst] = mine.questions;
        const outside = yield* fixture.as("admin").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.sma },
          slug: nf,
          title: "Kelas SMA",
        });
        const theirs = yield* fixture.as("admin").query(open, {
          examId: outside.id,
          slug: nf,
        });
        const [theirFirst] = theirs.questions;
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(add, { after: mineFirst.id, examId: mine.id, slug: nf })
            .pipe(Effect.flip),
          teacher
            .mutation(add, {
              after: theirFirst.id,
              examId: outside.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(copy, {
              examId: outside.id,
              questionId: theirFirst.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(remove, {
              examId: outside.id,
              questionId: theirFirst.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(move, {
              examId: outside.id,
              index: 0,
              questionId: theirFirst.id,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(answer, {
              answers: theirFirst.answers,
              examId: outside.id,
              key: null,
              questionId: theirFirst.id,
              revision: 0,
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(points, {
              examId: outside.id,
              points: 3,
              questionId: theirFirst.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
        expect(yield* fixture.run(questionRows)).toHaveLength(2);
      })
  );
  it.effect(
    "sets the points of a question, and keeps its answers, its key, and its revision",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Poin");
        const [first] = exam.questions;
        const scored = yield* teacher.mutation(points, {
          examId: exam.id,
          points: 7,
          questionId: first.id,
          slug: nf,
        });
        expect(scored).toMatchObject({
          id: first.id,
          key: first.key,
          points: 7,
          revision: first.revision,
        });
        expect(scored.answers).toEqual(first.answers);
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(opened.questions[0]).toEqual(scored);
      })
  );

  it.effect(
    "takes points from one to one hundred as whole numbers, and refuses any other value with nothing written",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Batas poin");
        const [first] = exam.questions;
        const setPoints = (value: number) =>
          teacher.mutation(points, {
            examId: exam.id,
            points: value,
            questionId: first.id,
            slug: nf,
          });
        const refusals = yield* Effect.forEach([0, 101, 2.5, -1], (value) =>
          setPoints(value).pipe(Effect.flip)
        );
        expect(refusals).toHaveLength(4);
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(opened.questions[0].points).toBe(first.points);
        const lowest = yield* setPoints(1);
        const highest = yield* setPoints(100);
        expect([lowest.points, highest.points]).toEqual([1, 100]);
      })
  );

  it.effect(
    "copies a question with its points, and copies its rubric and explanation as documents of their own",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Salin");
        const [first] = exam.questions;
        yield* teacher.mutation(points, {
          examId: exam.id,
          points: 4,
          questionId: first.id,
          slug: nf,
        });
        const copied = yield* teacher.mutation(copy, {
          examId: exam.id,
          questionId: first.id,
          slug: nf,
        });
        expect(copied).toMatchObject({ points: 4 });
        expect(
          HashSet.size(
            HashSet.make(
              copied.prompt,
              copied.rubric,
              copied.explanation,
              first.prompt,
              first.rubric,
              first.explanation
            )
          )
        ).toBe(6);
        expect(yield* fixture.run(documentRows)).toHaveLength(6);
      })
  );
});
