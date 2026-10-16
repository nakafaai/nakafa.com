import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import refs from "@repo/backend/confect/_generated/refs";
import { nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { questionRows, teacherExam } from "@repo/backend/test/exams";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { answer } = refs.public.exams.questions;

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
    "refuses answers that are not single-answer choices, and writes nothing",
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
