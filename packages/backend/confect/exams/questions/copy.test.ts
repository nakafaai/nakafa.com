import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import {
  batchText,
  documentRowOf,
  nf,
  plantSteps,
  stepRows,
} from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { open } = refs.public.exams.exams;
const { copy } = refs.public.exams.questions;
const { open: openDocument } = refs.public.editor.documents;
const { submit } = refs.public.editor.steps;
const fold = refs.internal.editor.fold.fold;

describe("exams/questions/copy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "copies a question after the original, with the original's current text, steps after its snapshot included",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Salin");
        const [original] = exam.questions;
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId: original.prompt,
          slug: nf,
        });
        yield* fixture.internal.mutation(fold, { documentId: original.prompt });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(2, "rina", 1, "y"),
          documentId: original.prompt,
          slug: nf,
        });
        const copied = yield* teacher.mutation(copy, {
          examId: exam.id,
          questionId: original.id,
          slug: nf,
        });
        const opened = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(Arr.map(opened.questions, (question) => question.id)).toEqual([
          original.id,
          copied.id,
        ]);
        const source = yield* teacher.query(openDocument, {
          clientId: "reader",
          documentId: original.prompt,
          slug: nf,
        });
        const duplicate = yield* teacher.query(openDocument, {
          clientId: "reader",
          documentId: copied.prompt,
          slug: nf,
        });
        expect(duplicate.snapshot).toEqual({
          content: source.snapshot.content,
          version: 0,
        });
        expect(Arr.map(duplicate.steps, (step) => step.step)).toEqual(
          Arr.map(source.steps, (step) => step.step)
        );
        const copiedRow = yield* fixture.run(documentRowOf(copied.prompt));
        expect(copiedRow.head).toBe(1);
      })
  );

  it.effect(
    "copies a question with no steps after its snapshot, to a prompt with no steps",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Tanpa langkah");
        const [original] = exam.questions;
        const copied = yield* teacher.mutation(copy, {
          examId: exam.id,
          questionId: original.id,
          slug: nf,
        });
        const duplicate = yield* teacher.query(openDocument, {
          clientId: "reader",
          documentId: copied.prompt,
          slug: nf,
        });
        expect(duplicate.steps).toEqual([]);
        const copiedRow = yield* fixture.run(documentRowOf(copied.prompt));
        expect(copiedRow.head).toBe(0);
      })
  );

  it.effect(
    "copies every step of the history after its snapshot, renumbered from version 1 in order",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Banyak langkah");
        const [original] = exam.questions;
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId: original.prompt,
          slug: nf,
        });
        const copied = yield* teacher.mutation(copy, {
          examId: exam.id,
          questionId: original.id,
          slug: nf,
        });
        const steps = yield* fixture.run(stepRows);
        const copiedSteps = Arr.filter(
          steps,
          (step) => step.documentId === copied.prompt
        );
        expect(Arr.map(copiedSteps, (step) => step.version)).toEqual([1, 2, 3]);
      })
  );

  it.effect(
    "copies a history of exactly one page of steps, renumbered from version 1 to the page's size",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Satu halaman");
        const [original] = exam.questions;
        yield* plantSteps(fixture, original.prompt, STEP_PAGE_STEPS);
        const copied = yield* teacher.mutation(copy, {
          examId: exam.id,
          questionId: original.id,
          slug: nf,
        });
        const steps = yield* fixture.run(stepRows);
        const copiedSteps = Arr.filter(
          steps,
          (step) => step.documentId === copied.prompt
        );
        expect(Arr.map(copiedSteps, (step) => step.version)).toEqual(
          Arr.makeBy(STEP_PAGE_STEPS, (index) => index + 1)
        );
      })
  );

  it.effect(
    "refuses to copy a history longer than one page of steps, before it reads a step, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Riwayat panjang");
        const [original] = exam.questions;
        yield* plantSteps(fixture, original.prompt, STEP_PAGE_STEPS + 1);
        const refused = yield* teacher
          .mutation(copy, {
            examId: exam.id,
            questionId: original.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "QuestionHistoryLong",
          code: "QUESTION_HISTORY_LONG",
        });
        const questions = yield* teacher.query(open, {
          examId: exam.id,
          slug: nf,
        });
        expect(questions.questions).toHaveLength(1);
        expect(yield* fixture.run(stepRows)).toHaveLength(STEP_PAGE_STEPS + 1);
      })
  );
});
