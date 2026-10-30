import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { look, screen } = refs.public.exams.screens;
const { answer, paper } = refs.public.exams.sittings;
const questions = refs.public.exams.questions;

/** The screen rows of the test database, as the student's looks wrote them. */
const screenRows = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examScreens")
        .index("by_creation_time")
        .take(10)
        .pipe(Effect.orDie)
    )
  );

/** A sitting the student entered from device 1, with the IDs of its attempt and its first question. */
const enteredSitting = Effect.fn("test.screen.entered")(function* (
  fixture: SittingFixture
) {
  const made = yield* openedSitting(fixture, "PTS");
  const entered = yield* enterOk(fixture, {
    deviceId: deviceOf(1),
    sittingId: made.id,
    token: made.token,
  });
  const { questions } = yield* fixture
    .as("student")
    .query(paper, { deviceId: deviceOf(1), sittingId: made.id, slug: nf });
  return {
    attemptId: entered.attempt,
    questionId: questions[0].id,
    sittingId: made.id,
  };
});

describe("exams/sittings screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows the proctor the question the student looks at, with its prompt and the student's answer, and nothing before the first look",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entered = yield* enteredSitting(fixture);
        const read = () =>
          fixture.as("teacher").query(screen, {
            attemptId: entered.attemptId,
            sittingId: entered.sittingId,
            slug: nf,
          });
        expect(yield* read()).toBeNull();
        yield* fixture.as("student").mutation(look, {
          attemptId: entered.attemptId,
          deviceId: deviceOf(1),
          questionId: entered.questionId,
          slug: nf,
        });
        // The student looks at the question before answering it, so the screen shows no response yet.
        expect(yield* read()).toMatchObject({ number: 1, response: null });
        yield* fixture.as("student").mutation(answer, {
          deviceId: deviceOf(1),
          questionId: entered.questionId,
          response: ["option-2"],
          sittingId: entered.sittingId,
          slug: nf,
          version: 1,
        });
        expect(yield* read()).toMatchObject({
          interactions: newChoiceAnswers(),
          number: 1,
          prompt: expect.any(String),
          response: ["option-2"],
        });
      })
  );

  it.effect(
    "shows no screen once the teacher removes the question the student was on, while the sitting runs",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entered = yield* enteredSitting(fixture);
        yield* fixture.as("student").mutation(look, {
          attemptId: entered.attemptId,
          deviceId: deviceOf(1),
          questionId: entered.questionId,
          slug: nf,
        });
        const { examId } = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("examSittings")
              .get(entered.sittingId)
              .pipe(Effect.orDie)
          )
        );
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(questions.add, {
          after: entered.questionId,
          examId,
          slug: nf,
        });
        yield* teacher.mutation(questions.remove, {
          examId,
          questionId: entered.questionId,
          slug: nf,
        });
        expect(
          yield* teacher.query(screen, {
            attemptId: entered.attemptId,
            sittingId: entered.sittingId,
            slug: nf,
          })
        ).toBeNull();
      })
  );

  it.effect(
    "keeps one row for each attempt, writes nothing for the same question again, and refuses a question of another exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entered = yield* enteredSitting(fixture);
        const lookAt = (questionId: typeof entered.questionId) =>
          fixture.as("student").mutation(look, {
            attemptId: entered.attemptId,
            deviceId: deviceOf(1),
            questionId,
            slug: nf,
          });
        yield* lookAt(entered.questionId);
        const [first] = yield* screenRows(fixture);
        vi.setSystemTime(TENANCY_NOW + 5000);
        yield* lookAt(entered.questionId);
        expect(yield* screenRows(fixture)).toEqual([first]);
        const other = yield* teacherExam(fixture, "Lain");
        const refused = yield* lookAt(other.questions[0].id).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "QuestionNotInExam" });
        expect(yield* screenRows(fixture)).toHaveLength(1);
      })
  );

  it.effect(
    "moves the row to the next question, and refuses another device and a student who reads a screen",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entered = yield* enteredSitting(fixture);
        // A second question of the sitting's exam, which the student moves to.
        const other = yield* teacherExam(fixture, "Lain");
        const second = other.questions[0].id;
        yield* fixture.run(
          Effect.gen(function* () {
            const sitting = yield* (yield* DatabaseReader)
              .table("examSittings")
              .get(entered.sittingId)
              .pipe(Effect.orDie);
            const exam = yield* (yield* DatabaseReader)
              .table("exams")
              .get(sitting.examId)
              .pipe(Effect.orDie);
            yield* (yield* DatabaseWriter)
              .table("exams")
              .patch(exam._id, { questions: [...exam.questions, second] })
              .pipe(Effect.orDie);
          })
        );
        yield* fixture.as("student").mutation(look, {
          attemptId: entered.attemptId,
          deviceId: deviceOf(1),
          questionId: entered.questionId,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + 3000);
        yield* fixture.as("student").mutation(look, {
          attemptId: entered.attemptId,
          deviceId: deviceOf(1),
          questionId: second,
          slug: nf,
        });
        expect(yield* screenRows(fixture)).toMatchObject([
          { at: TENANCY_NOW + 3000, question: second },
        ]);
        const device = yield* fixture
          .as("student")
          .mutation(look, {
            attemptId: entered.attemptId,
            deviceId: deviceOf(2),
            questionId: entered.questionId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(device).toMatchObject({ _tag: "SecondDevice" });
        const student = yield* fixture
          .as("student")
          .query(screen, {
            attemptId: entered.attemptId,
            sittingId: entered.sittingId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(student).toMatchObject({ _tag: "AccessDenied" });
      })
  );
});
