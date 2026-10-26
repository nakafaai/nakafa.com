import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { answer, copy, template } = refs.public.exams.questions;

/** The key of the question's one choice, marking these options correct. */
const keyOf = (...correct: [string, ...string[]]) =>
  [{ correct, interaction: "choice", kind: "choice" }] as const;

describe("exams/questions/template", () => {
  it.effect(
    "turns a single-answer choice into a complex one that takes every option, keeps its key, and then takes a key of several options",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Kompleks");
        const [question] = exam.questions;
        const keyed = yield* teacher.mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: keyOf("option-2"),
          questionId: question.id,
          revision: 0,
          slug: nf,
        });
        const complex = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: keyed.revision,
          slug: nf,
          template: "choices",
        });
        expect(complex).toMatchObject({
          key: keyOf("option-2"),
          revision: keyed.revision + 1,
          template: "choices",
        });
        expect(complex.answers[0]).toMatchObject({
          kind: "choice",
          maxChoices: 4,
          minChoices: 1,
        });
        const several = yield* teacher.mutation(answer, {
          answers: complex.answers,
          examId: exam.id,
          key: keyOf("option-1", "option-3"),
          questionId: question.id,
          revision: complex.revision,
          slug: nf,
        });
        expect(several.key).toEqual(keyOf("option-1", "option-3"));
        const single = yield* teacher
          .mutation(answer, {
            answers: question.answers,
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: several.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(single).toMatchObject({ _tag: "AnswersDoNotFit" });
      })
  );

  it.effect(
    "turns a complex choice that marks several options back into a single-answer choice with no key, and keeps a key of one option",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Kembali");
        const [question] = exam.questions;
        const complex = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "choices",
        });
        const several = yield* teacher.mutation(answer, {
          answers: complex.answers,
          examId: exam.id,
          key: keyOf("option-1", "option-4"),
          questionId: question.id,
          revision: complex.revision,
          slug: nf,
        });
        const single = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: several.revision,
          slug: nf,
          template: "choice",
        });
        expect(single).toMatchObject({ key: null, template: "choice" });
        expect(single.answers[0]).toMatchObject({ maxChoices: 1 });
        const one = yield* teacher.mutation(answer, {
          answers: single.answers,
          examId: exam.id,
          key: keyOf("option-3"),
          questionId: question.id,
          revision: single.revision,
          slug: nf,
        });
        const again = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: one.revision,
          slug: nf,
          template: "choices",
        });
        const back = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: again.revision,
          slug: nf,
          template: "choice",
        });
        expect(back).toMatchObject({
          key: keyOf("option-3"),
          template: "choice",
        });
      })
  );

  it.effect(
    "saves nothing for the question's own template, refuses a stale revision, and refuses a scheduled exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Tetap");
        const [question] = exam.questions;
        const same = yield* teacher.mutation(template, {
          examId: exam.id,
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "choice",
        });
        expect(same).toMatchObject({ revision: 0, template: "choice" });
        const stale = yield* teacher
          .mutation(template, {
            examId: exam.id,
            questionId: question.id,
            revision: 3,
            slug: nf,
            template: "choices",
          })
          .pipe(Effect.flip);
        expect(stale).toMatchObject({ _tag: "RevisionStale", current: 0 });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("exams")
              .patch(exam.id, { frozenAt: TENANCY_NOW })
              .pipe(Effect.orDie)
          )
        );
        const frozen = yield* teacher
          .mutation(template, {
            examId: exam.id,
            questionId: question.id,
            revision: 0,
            slug: nf,
            template: "choices",
          })
          .pipe(Effect.flip);
        expect(frozen).toMatchObject({ _tag: "ExamFrozen" });
      })
  );

  it.effect("copies a complex choice as a complex choice", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const exam = yield* teacherExam(fixture, "Salin");
      const [question] = exam.questions;
      yield* teacher.mutation(template, {
        examId: exam.id,
        questionId: question.id,
        revision: 0,
        slug: nf,
        template: "choices",
      });
      const copied = yield* teacher.mutation(copy, {
        examId: exam.id,
        questionId: question.id,
        slug: nf,
      });
      expect(copied).toMatchObject({ template: "choices" });
      expect(copied.answers[0]).toMatchObject({ maxChoices: 4 });
    })
  );
});
