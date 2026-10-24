import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { PRUNE_PAGE_STEPS } from "@repo/backend/confect/editor/prune";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import {
  batchText,
  denied,
  documentRows,
  nf,
  plantSteps,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import {
  archiveUnit,
  fillExam,
  questionRows,
  teacherExam,
} from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, open } = refs.public.exams.exams;
const { add, move, remove, copy, answer } = refs.public.exams.questions;
const { submit } = refs.public.editor.steps;

describe("exams/questions", () => {
  it.effect(
    "adds a question after the one it names, and writes its prompt document",
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
          revision: 0,
          template: "choice",
        });
        const opened = yield* fixture.as("teacher").query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(Arr.map(opened.questions, (question) => question.id)).toEqual([
          first.id,
          added.id,
        ]);
        expect(yield* fixture.run(documentRows)).toHaveLength(2);
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
        expect(yield* fixture.run(documentRows)).toHaveLength(1);
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
        ]);
        expect(refusals).toMatchObject([
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
        ]);
        expect(refusals).toMatchObject([
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
        ]);
        expect(refusals).toMatchObject([
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
});

describe("exams/questions remove", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.effect(
    "refuses to remove the last question of an exam, and removes another with its prompt, snapshot, and steps once the scheduled deletion runs",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Hapus");
        const [first] = exam.questions;
        const last = yield* teacher
          .mutation(remove, { examId: exam.id, questionId: first.id, slug: nf })
          .pipe(Effect.flip);
        expect(last).toMatchObject({ _tag: "ExamEmpty", code: "EXAM_EMPTY" });
        const second = yield* teacher.mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId: first.prompt,
          slug: nf,
        });
        const removed = yield* teacher.mutation(remove, {
          examId: exam.id,
          questionId: first.id,
          slug: nf,
        });
        expect(removed.questions).toEqual([second.id]);
        yield* fixture.finishScheduled();
        const documents = yield* fixture.run(documentRows);
        expect(Arr.map(documents, (document) => document._id)).toEqual([
          second.prompt,
        ]);
        const snapshots = yield* fixture.run(snapshotRows);
        expect(Arr.map(snapshots, (snapshot) => snapshot.documentId)).toEqual([
          second.prompt,
        ]);
        const steps = yield* fixture.run(stepRows);
        expect(
          Arr.filter(steps, (step) => step.documentId === first.prompt)
        ).toEqual([]);
        expect(yield* fixture.run(questionRows)).toHaveLength(1);
      })
  );

  it.effect(
    "removes a question whose prompt has more than one page of steps, and deletes those steps in scheduled calls, not in the removal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Halaman");
        const [first] = exam.questions;
        const second = yield* teacher.mutation(add, {
          after: first.id,
          examId: exam.id,
          slug: nf,
        });
        const stepCount = PRUNE_PAGE_STEPS + 1;
        yield* plantSteps(fixture, first.prompt, stepCount);
        yield* teacher.mutation(remove, {
          examId: exam.id,
          questionId: first.id,
          slug: nf,
        });
        expect(yield* fixture.run(stepRows)).toHaveLength(stepCount);
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(stepRows)).toEqual([]);
        const documents = yield* fixture.run(documentRows);
        expect(Arr.map(documents, (document) => document._id)).toEqual([
          second.prompt,
        ]);
      })
  );
});
