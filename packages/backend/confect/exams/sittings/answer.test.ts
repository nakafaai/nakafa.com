import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  encodeAnswers,
  matchAnswers,
  newChoiceAnswers,
  shortAnswers,
} from "@repo/backend/confect/exams/question";
import type { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import {
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { answer, paper } = refs.public.exams.sittings;

/** A question of the exam that a test sitting holds. */
type QuestionId = GenericId.GenericId<"examQuestions">;

/** Saves one response to a question, as the bound device of the student. */
const answerAs = (
  fixture: SittingFixture,
  args: {
    deviceId: string;
    questionId: QuestionId;
    response: ExamResponse;
    sittingId: GenericId.GenericId<"examSittings">;
    version: number;
  }
) => fixture.as("student").mutation(answer, { ...args, slug: nf });

/** Replaces the interactions of a question, so a test can give it another shape. */
const setInteractions = (
  fixture: SittingFixture,
  questionId: QuestionId,
  interactions: Arr.NonEmptyReadonlyArray<Interaction>
) =>
  fixture.run(
    Effect.gen(function* () {
      const answers = yield* encodeAnswers(interactions);
      yield* (yield* DatabaseWriter)
        .table("examQuestions")
        .patch(questionId, { answers });
    })
  );

/** A single-answer choice, which the tests copy to give a question another shape. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/** Whether an interaction is a choice. */
const isChoice = (interaction: Interaction): interaction is Choice =>
  interaction.kind === "choice";

/** The choice of a new question, which the tests change to give a question another shape. */
const firstChoice = Effect.fn("test.answer.choice")(function* () {
  return yield* Effect.fromOption(Arr.findFirst(newChoiceAnswers(), isChoice));
});

/** A sitting that the student has entered from device 1, with the first question of its exam. */
const enteredSitting = (fixture: SittingFixture) =>
  Effect.gen(function* () {
    const made = yield* openedSitting(fixture, "PTS");
    yield* enterOk(fixture, {
      deviceId: deviceOf(1),
      sittingId: made.id,
      token: made.token,
    });
    const { questions } = yield* fixture
      .as("student")
      .query(paper, { deviceId: deviceOf(1), sittingId: made.id, slug: nf });
    return { question: questions[0].id, sittingId: made.id };
  });

/** The count of the journal's entries, which a test reads before and after an action. */
const journalCount = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("journalEntries")
        .index("by_creation_time")
        .take(1000)
        .pipe(
          Effect.map((entries) => entries.length),
          Effect.orDie
        )
    )
  );

describe("exams/sittings answer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "saves a response, and the next answer replaces it in one row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-2"],
          sittingId,
          version: 1,
        });
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-3"],
          sittingId,
          version: 2,
        });
        const { questions } = yield* fixture
          .as("student")
          .query(paper, { deviceId: deviceOf(1), sittingId, slug: nf });
        expect(questions[0].response).toEqual(["option-3"]);
        const rows = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("examAnswers")
              .index("by_creation_time")
              .take(10)
              .pipe(Effect.orDie)
          )
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          question,
          response: ["option-3"],
          tenantId: fixture.tenants.nf,
          version: 2,
        });
      })
  );

  it.effect("writes no journal entry for a student's answer", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      const before = yield* journalCount(fixture);
      yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: ["option-1"],
        sittingId,
        version: 1,
      });
      expect(yield* journalCount(fixture)).toBe(before);
    })
  );

  it.effect(
    "refuses a response that names an option the question does not hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-9"],
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect(
    "refuses an empty response, which is below the choice's minimum",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: [],
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect("refuses two options where the choice takes one", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: ["option-1", "option-2"],
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
    })
  );

  it.effect(
    "refuses a repeated option, and takes two distinct options where the choice allows two",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        const choice = yield* firstChoice();
        yield* setInteractions(fixture, question, [
          { ...choice, maxChoices: 2 },
        ]);
        const repeated = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-1", "option-1"],
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(repeated).toMatchObject({ _tag: "ResponseDoesNotFit" });
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-1", "option-2"],
          sittingId,
          version: 1,
        });
      })
  );

  it.effect(
    "saves the text a student types in a short answer, blank text included, and refuses options there",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* setInteractions(fixture, question, shortAnswers());
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: { text: "Jakarta" },
          sittingId,
          version: 1,
        });
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: { text: "" },
          sittingId,
          version: 2,
        });
        const { questions } = yield* fixture
          .as("student")
          .query(paper, { deviceId: deviceOf(1), sittingId, slug: nf });
        expect(questions[0].response).toEqual({ text: "" });
        const options = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-1"],
          sittingId,
          version: 3,
        }).pipe(Effect.flip);
        expect(options).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect(
    "refuses any response to a question whose one interaction is neither a choice nor a text entry",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* setInteractions(fixture, question, [
          { id: "essay", kind: "extendedText", label: "Answer" },
        ]);
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: { text: "Esai" },
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect(
    "saves the pairs a student makes in a match, some or all, and refuses a statement or an answer paired twice",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* setInteractions(fixture, question, matchAnswers());
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: { pairs: [{ source: "source-1", target: "target-2" }] },
          sittingId,
          version: 1,
        });
        const twice = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: {
            pairs: [
              { source: "source-1", target: "target-2" },
              { source: "source-2", target: "target-2" },
            ],
          },
          sittingId,
          version: 2,
        }).pipe(Effect.flip);
        expect(twice).toMatchObject({ _tag: "ResponseDoesNotFit" });
        const unknown = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: { pairs: [{ source: "source-9", target: "target-1" }] },
          sittingId,
          version: 2,
        }).pipe(Effect.flip);
        expect(unknown).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect("refuses typed text where the question is a choice", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: { text: "B" },
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
    })
  );

  it.effect(
    "refuses a question with more than one interaction, which takes no response yet",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        const choice = yield* firstChoice();
        yield* setInteractions(fixture, question, [
          choice,
          { ...choice, id: "second" },
        ]);
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-1"],
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ResponseDoesNotFit" });
      })
  );

  it.effect("refuses a question that the sitting's exam does not hold", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { sittingId } = yield* enteredSitting(fixture);
      const other = yield* teacherExam(fixture, "Lain");
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: other.questions[0].id,
        response: ["option-1"],
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "QuestionNotInExam" });
    })
  );

  it.effect(
    "refuses an answer from a device that does not own the attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(2),
          questionId: question,
          response: ["option-1"],
          sittingId,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SecondDevice" });
      })
  );

  it.effect("refuses an answer once the deadline has passed", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      vi.setSystemTime(CLOSES);
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: ["option-1"],
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "AttemptClosed" });
    })
  );

  it.effect(
    "refuses a version that is not newer than the saved answer, and keeps the saved one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { question, sittingId } = yield* enteredSitting(fixture);
        yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: question,
          response: ["option-2"],
          sittingId,
          version: 3,
        });
        for (const version of [2, 3]) {
          const stale = yield* answerAs(fixture, {
            deviceId: deviceOf(1),
            questionId: question,
            response: ["option-4"],
            sittingId,
            version,
          }).pipe(Effect.flip);
          expect(stale).toMatchObject({ _tag: "StaleAnswer" });
        }
        const { questions } = yield* fixture
          .as("student")
          .query(paper, { deviceId: deviceOf(1), sittingId, slug: nf });
        expect(questions[0]).toMatchObject({
          response: ["option-2"],
          version: 3,
        });
      })
  );

  it.effect(
    "refuses an answer from a student who holds no attempt in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* answerAs(fixture, {
          deviceId: deviceOf(1),
          questionId: (yield* teacherExam(fixture, "Lain")).questions[0].id,
          response: ["option-1"],
          sittingId: made.id,
          version: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect("refuses an answer to a sitting of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("examSittings")
            .patch(sittingId, { tenantId: fixture.tenants.other })
            .pipe(Effect.orDie)
        )
      );
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: ["option-1"],
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "NotInSitting" });
    })
  );

  it.effect("refuses an answer to a school that is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { question, sittingId } = yield* enteredSitting(fixture);
      yield* fixture.run(suspend(fixture.tenants.nf));
      const failure = yield* answerAs(fixture, {
        deviceId: deviceOf(1),
        questionId: question,
        response: ["option-1"],
        sittingId,
        version: 1,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "SittingLocked" });
    })
  );
});
