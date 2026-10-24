import { describe, expect, it } from "@effect/vitest";
import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import refs from "@repo/backend/confect/_generated/refs";
import { CONVEX_DOCUMENT_LIMIT } from "@repo/backend/confect/editor/size";
import { nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { questionRows, teacherExam } from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { answer } = refs.public.exams.questions;

/** A label of one empty paragraph, which the contract allows in an option. */
const emptyLabel: typeof ContentDocumentSchema.Type = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

/** The answers of a question with its choice holding `count` options, labelled A to E in order. */
const withOptionCount = (
  answers: Arr.NonEmptyReadonlyArray<typeof InteractionSchema.Type>,
  count: number
) =>
  Arr.map(answers, (interaction) =>
    interaction.kind === "choice"
      ? {
          ...interaction,
          options: Arr.makeBy(count, (index) => ({
            id: `option-${index + 1}`,
            label: emptyLabel,
          })),
        }
      : interaction
  );

describe("exams/questions/answer", () => {
  it.effect(
    "saves the answers and the key at the revision the editor saw, and clears the key at the next revision",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Kunci");
        const [question] = exam.questions;
        const saved = yield* teacher.mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: [
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ],
          questionId: question.id,
          revision: 0,
          slug: nf,
        });
        expect(saved).toMatchObject({ revision: 1 });
        expect(saved.key).toEqual([
          { correct: ["option-2"], interaction: "choice", kind: "choice" },
        ]);
        const cleared = yield* teacher.mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: null,
          questionId: question.id,
          revision: 1,
          slug: nf,
        });
        expect(cleared).toMatchObject({ key: null, revision: 2 });
      })
  );

  it.effect("refuses a stale revision, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const exam = yield* teacherExam(fixture, "Revisi");
      const [question] = exam.questions;
      yield* teacher.mutation(answer, {
        answers: question.answers,
        examId: exam.id,
        key: [{ correct: ["option-3"], interaction: "choice", kind: "choice" }],
        questionId: question.id,
        revision: 0,
        slug: nf,
      });
      const stale = yield* teacher
        .mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: null,
          questionId: question.id,
          revision: 0,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(stale).toMatchObject({ _tag: "RevisionStale", current: 1 });
      const [row] = yield* fixture.run(questionRows);
      expect(row.revision).toBe(1);
      expect(row.key).not.toBeNull();
    })
  );

  it.effect(
    "refuses a key that names an option the question does not have, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Kunci salah");
        const [question] = exam.questions;
        const refused = yield* teacher
          .mutation(answer, {
            answers: question.answers,
            examId: exam.id,
            key: [
              { correct: ["option-9"], interaction: "choice", kind: "choice" },
            ],
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "KeyDoesNotFit",
          code: "KEY_DOES_NOT_FIT",
        });
        const rows = yield* fixture.run(questionRows);
        expect(Arr.map(rows, (row) => [row.revision, row.key])).toEqual([
          [0, null],
        ]);
      })
  );

  it.effect(
    "refuses an interaction that is not a choice, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Bukan pilihan");
        const [question] = exam.questions;
        const text = yield* Schema.decodeEffect(InteractionSchema)({
          id: "text",
          kind: "textEntry",
          label: "Answer",
        }).pipe(Effect.orDie);
        const refused = yield* teacher
          .mutation(answer, {
            answers: [text],
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AnswersDoNotFit",
          code: "ANSWERS_DO_NOT_FIT",
        });
        const rows = yield* fixture.run(questionRows);
        expect(Arr.map(rows, (row) => row.revision)).toEqual([0]);
      })
  );

  it.effect(
    "refuses a choice that takes more than one answer, though its key would fit it, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Dua jawaban");
        const [question] = exam.questions;
        const twoChoices = yield* Schema.decodeEffect(InteractionSchema)({
          id: "choice",
          kind: "choice",
          label: "Answer",
          maxChoices: 2,
          minChoices: 1,
          options: [
            {
              id: "option-1",
              label: { content: [{ type: "paragraph" }], type: "doc" },
            },
            {
              id: "option-2",
              label: { content: [{ type: "paragraph" }], type: "doc" },
            },
          ],
          shuffle: false,
        }).pipe(Effect.orDie);
        const refused = yield* teacher
          .mutation(answer, {
            answers: [twoChoices],
            examId: exam.id,
            key: [
              {
                correct: ["option-1", "option-2"],
                interaction: "choice",
                kind: "choice",
              },
            ],
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AnswersDoNotFit",
          code: "ANSWERS_DO_NOT_FIT",
        });
        const rows = yield* fixture.run(questionRows);
        expect(Arr.map(rows, (row) => [row.revision, row.key])).toEqual([
          [0, null],
        ]);
      })
  );

  it.effect(
    "refuses a choice that may take no option, though its key would fit it, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Boleh kosong");
        const [question] = exam.questions;
        const optional = yield* Schema.decodeEffect(InteractionSchema)({
          id: "choice",
          kind: "choice",
          label: "Answer",
          maxChoices: 1,
          minChoices: 0,
          options: [
            {
              id: "option-1",
              label: { content: [{ type: "paragraph" }], type: "doc" },
            },
            {
              id: "option-2",
              label: { content: [{ type: "paragraph" }], type: "doc" },
            },
          ],
          shuffle: false,
        }).pipe(Effect.orDie);
        const refused = yield* teacher
          .mutation(answer, {
            answers: [optional],
            examId: exam.id,
            key: [
              { correct: ["option-2"], interaction: "choice", kind: "choice" },
            ],
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AnswersDoNotFit",
          code: "ANSWERS_DO_NOT_FIT",
        });
        const rows = yield* fixture.run(questionRows);
        expect(Arr.map(rows, (row) => [row.revision, row.key])).toEqual([
          [0, null],
        ]);
      })
  );

  it.effect(
    "refuses an answer whose row would reach the limit of one stored document, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Terlalu besar");
        const [question] = exam.questions;
        const oversized = yield* Schema.decodeEffect(InteractionSchema)({
          id: "choice",
          kind: "choice",
          label: "Answer",
          maxChoices: 1,
          minChoices: 1,
          options: [
            {
              id: "option-1",
              label: {
                content: [
                  {
                    content: [
                      { text: "a".repeat(CONVEX_DOCUMENT_LIMIT), type: "text" },
                    ],
                    type: "paragraph",
                  },
                ],
                type: "doc",
              },
            },
            {
              id: "option-2",
              label: { content: [{ type: "paragraph" }], type: "doc" },
            },
          ],
          shuffle: false,
        }).pipe(Effect.orDie);
        const refused = yield* teacher
          .mutation(answer, {
            answers: [oversized],
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "DocumentTooLarge",
          limit: CONVEX_DOCUMENT_LIMIT,
        });
        const rows = yield* fixture.run(questionRows);
        expect(Arr.map(rows, (row) => [row.revision, row.key])).toEqual([
          [0, null],
        ]);
      })
  );

  it.effect(
    "refuses an answer from another school's teacher as a non-member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "Sekolah lain");
        const [question] = exam.questions;
        const failure = yield* (yield* otherSchoolTeacher(fixture))
          .mutation(answer, {
            answers: question.answers,
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "NotMember",
          code: "NOT_MEMBER",
        });
      })
  );
});

describe("exams/questions/answer options", () => {
  it.effect(
    "saves a choice of two to five options, and refuses a choice of one option, which the contract refuses, or of six",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Opsi");
        const [question] = exam.questions;
        const two = yield* teacher.mutation(answer, {
          answers: withOptionCount(question.answers, 2),
          examId: exam.id,
          key: null,
          questionId: question.id,
          revision: 0,
          slug: nf,
        });
        const five = yield* teacher.mutation(answer, {
          answers: withOptionCount(question.answers, 5),
          examId: exam.id,
          key: null,
          questionId: question.id,
          revision: 1,
          slug: nf,
        });
        expect(two.answers[0]).toMatchObject({
          options: [{ id: "option-1" }, { id: "option-2" }],
        });
        expect(five.answers[0]).toMatchObject({
          options: [
            { id: "option-1" },
            { id: "option-2" },
            { id: "option-3" },
            { id: "option-4" },
            { id: "option-5" },
          ],
        });
        const refused = yield* Effect.forEach([1, 6], (count) =>
          teacher
            .mutation(answer, {
              answers: withOptionCount(question.answers, count),
              examId: exam.id,
              key: null,
              questionId: question.id,
              revision: 2,
              slug: nf,
            })
            .pipe(Effect.flip)
        );
        expect(refused).toMatchObject([
          { _tag: "SchemaError" },
          { _tag: "AnswersDoNotFit" },
        ]);
        const [row] = yield* fixture.run(questionRows);
        expect(row.revision).toBe(2);
      })
  );
});
