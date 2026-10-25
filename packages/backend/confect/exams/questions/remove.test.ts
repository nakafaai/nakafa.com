import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { PRUNE_PAGE_STEPS } from "@repo/backend/confect/editor/prune";
import {
  batchText,
  documentRows,
  nf,
  plantSteps,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { questionRows, teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { add, remove } = refs.public.exams.questions;
const { submit } = refs.public.editor.steps;

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
        const secondDocuments = [
          second.prompt,
          second.rubric,
          second.explanation,
        ];
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
        expect(Arr.map(documents, (document) => document._id)).toEqual(
          secondDocuments
        );
        const snapshots = yield* fixture.run(snapshotRows);
        expect(Arr.map(snapshots, (snapshot) => snapshot.documentId)).toEqual(
          secondDocuments
        );
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
        const secondDocuments = [
          second.prompt,
          second.rubric,
          second.explanation,
        ];
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
        expect(Arr.map(documents, (document) => document._id)).toEqual(
          secondDocuments
        );
      })
  );
});
