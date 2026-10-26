import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  choiceAnswers,
  essayAnswers,
  matchAnswers,
  newChoiceAnswers,
  shortAnswers,
  textLabel,
} from "@repo/backend/confect/exams/question";
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
          labels: [],
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
          labels: [],
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
          labels: [],
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
          labels: [],
          questionId: question.id,
          revision: one.revision,
          slug: nf,
          template: "choices",
        });
        const back = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
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
          labels: [],
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "choice",
        });
        expect(same).toMatchObject({ revision: 0, template: "choice" });
        const stale = yield* teacher
          .mutation(template, {
            examId: exam.id,
            labels: [],
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
            labels: [],
            questionId: question.id,
            revision: 0,
            slug: nf,
            template: "choices",
          })
          .pipe(Effect.flip);
        expect(frozen).toMatchObject({ _tag: "ExamFrozen" });
      })
  );

  it.effect(
    "turns a choice into true or false with the two labels it is given and no key, keeps the labels a teacher retypes, refuses a third option, and keeps both options and the key back as a choice",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Benar salah");
        const [question] = exam.questions;
        const keyed = yield* teacher.mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: keyOf("option-1"),
          questionId: question.id,
          revision: 0,
          slug: nf,
        });
        const truth = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: ["Benar", "Salah"],
          questionId: question.id,
          revision: keyed.revision,
          slug: nf,
          template: "truefalse",
        });
        expect(truth).toMatchObject({ key: null, template: "truefalse" });
        expect(truth.answers).toEqual(
          choiceAnswers([textLabel("Benar"), textLabel("Salah")])
        );
        const retyped = yield* teacher.mutation(answer, {
          answers: choiceAnswers([textLabel("صحيح"), textLabel("خطأ")]),
          examId: exam.id,
          key: keyOf("option-2"),
          questionId: question.id,
          revision: truth.revision,
          slug: nf,
        });
        expect(retyped.key).toEqual(keyOf("option-2"));
        const third = yield* teacher
          .mutation(answer, {
            answers: choiceAnswers([
              textLabel("Benar"),
              textLabel("Salah"),
              textLabel("Mungkin"),
            ]),
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: retyped.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(third).toMatchObject({ _tag: "AnswersDoNotFit" });
        const back = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
          questionId: question.id,
          revision: retyped.revision,
          slug: nf,
          template: "choice",
        });
        expect(back).toMatchObject({
          key: keyOf("option-2"),
          template: "choice",
        });
        expect(back.answers[0]).toMatchObject({
          options: [
            { label: textLabel("صحيح") },
            { label: textLabel("خطأ") },
          ],
        });
      })
  );

  it.effect(
    "turns a choice into cause and effect with five labelled options, and refuses labels that do not name each fixed option once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Sebab akibat");
        const [question] = exam.questions;
        const relations = ["S1", "S2", "S3", "S4", "S5"];
        const cause = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: relations,
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "cause",
        });
        expect(cause).toMatchObject({ key: null, template: "cause" });
        expect(cause.answers[0]).toMatchObject({
          maxChoices: 1,
          options: relations.map((text, index) => ({
            id: `option-${index + 1}`,
            label: textLabel(text),
          })),
        });
        const short = yield* teacher
          .mutation(template, {
            examId: exam.id,
            labels: ["S1", "S2", "S3", "S4"],
            questionId: question.id,
            revision: cause.revision,
            slug: nf,
            template: "truefalse",
          })
          .pipe(Effect.flip);
        expect(short).toMatchObject({ _tag: "AnswersDoNotFit" });
        const unasked = yield* teacher
          .mutation(template, {
            examId: exam.id,
            labels: ["S1"],
            questionId: question.id,
            revision: cause.revision,
            slug: nf,
            template: "choice",
          })
          .pipe(Effect.flip);
        expect(unasked).toMatchObject({ _tag: "AnswersDoNotFit" });
      })
  );

  it.effect(
    "turns a choice into a short answer that takes accepted answers, and back into a new choice with no key",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Isian");
        const [question] = exam.questions;
        const keyed = yield* teacher.mutation(answer, {
          answers: question.answers,
          examId: exam.id,
          key: keyOf("option-2"),
          questionId: question.id,
          revision: 0,
          slug: nf,
        });
        const short = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
          questionId: question.id,
          revision: keyed.revision,
          slug: nf,
          template: "short",
        });
        expect(short).toMatchObject({ key: null, template: "short" });
        expect(short.answers).toEqual(shortAnswers());
        const accepted = [
          {
            accepted: {
              acceptedAnswers: ["Jakarta", "DKI Jakarta"],
              collapseWhitespace: true,
              ignoreCase: true,
              kind: "text",
            },
            interaction: "entry",
            kind: "textEntry",
          },
        ] as const;
        const typed = yield* teacher.mutation(answer, {
          answers: short.answers,
          examId: exam.id,
          key: accepted,
          questionId: question.id,
          revision: short.revision,
          slug: nf,
        });
        expect(typed.key).toEqual(accepted);
        const choices = yield* teacher
          .mutation(answer, {
            answers: question.answers,
            examId: exam.id,
            key: null,
            questionId: question.id,
            revision: typed.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(choices).toMatchObject({ _tag: "AnswersDoNotFit" });
        const back = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
          questionId: question.id,
          revision: typed.revision,
          slug: nf,
          template: "choice",
        });
        expect(back).toMatchObject({ key: null, template: "choice" });
        expect(back.answers).toEqual(newChoiceAnswers());
      })
  );

  it.effect(
    "turns a choice into an essay with one long text and no key, which still saves no key",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Esai");
        const [question] = exam.questions;
        const essay = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "essay",
        });
        expect(essay).toMatchObject({ key: null, template: "essay" });
        expect(essay.answers).toEqual(essayAnswers());
        const refused = yield* teacher
          .mutation(answer, {
            answers: essay.answers,
            examId: exam.id,
            key: keyOf("option-1"),
            questionId: question.id,
            revision: essay.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "KeyDoesNotFit" });
      })
  );

  it.effect(
    "turns a choice into matching, which takes a key that pairs every statement once and refuses any other",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Jodohkan");
        const [question] = exam.questions;
        const match = yield* teacher.mutation(template, {
          examId: exam.id,
          labels: [],
          questionId: question.id,
          revision: 0,
          slug: nf,
          template: "match",
        });
        expect(match).toMatchObject({ key: null, template: "match" });
        expect(match.answers).toEqual(matchAnswers());
        const pairs = [
          { source: "source-1", target: "target-3" },
          { source: "source-2", target: "target-1" },
          { source: "source-3", target: "target-2" },
        ] as const;
        const keyed = yield* teacher.mutation(answer, {
          answers: match.answers,
          examId: exam.id,
          key: [{ interaction: "match", kind: "match", pairs }],
          questionId: question.id,
          revision: match.revision,
          slug: nf,
        });
        expect(keyed.key).toEqual([
          { interaction: "match", kind: "match", pairs },
        ]);
        const partial = yield* teacher
          .mutation(answer, {
            answers: match.answers,
            examId: exam.id,
            key: [
              { interaction: "match", kind: "match", pairs: [pairs[0], pairs[1]] },
            ],
            questionId: question.id,
            revision: keyed.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(partial).toMatchObject({ _tag: "KeyDoesNotFit" });
        const twice = yield* teacher
          .mutation(answer, {
            answers: match.answers,
            examId: exam.id,
            key: [
              {
                interaction: "match",
                kind: "match",
                pairs: [
                  pairs[0],
                  pairs[1],
                  { source: "source-3", target: "target-3" },
                ],
              },
            ],
            questionId: question.id,
            revision: keyed.revision,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(twice).toMatchObject({ _tag: "KeyDoesNotFit" });
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
        labels: [],
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
