import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableRef, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  confirmAnswer,
  confirmAnswerIn,
  forgetAttempt,
  type KeptAttempt,
  keepAnswer,
  keepAnswerIn,
  keptAnswersFor,
  readKept,
  readKeptResponse,
  settleSent,
  submittedKeysOf,
} from "@/components/exams/sitting/keep";

const SITTING = "sitting-a";
const ATTEMPT = "attempt-a";
const QUESTION = "question-a";
const NOTHING: KeptAttempt = { answers: {} };
const RESPONSE = ["option-b"];

/** The answer of one choice, chosen at a device time and numbered with a version. */
const answerAt = (answeredAt: number) => ({
  answeredAt,
  response: RESPONSE,
  version: 1,
});

describe("keepAnswerIn", () => {
  it("keeps the answer for its question in place of the one kept before", () => {
    const first = keepAnswerIn(NOTHING, QUESTION, answerAt(1));
    expect(first.answers[QUESTION]).toEqual(answerAt(1));
    expect(keepAnswerIn(first, QUESTION, answerAt(2)).answers).toEqual({
      [QUESTION]: answerAt(2),
    });
  });
});

describe("confirmAnswerIn", () => {
  it("drops the answer the server confirmed, and keeps a newer one", () => {
    const kept = keepAnswerIn(NOTHING, QUESTION, answerAt(5));
    expect(confirmAnswerIn(kept, QUESTION, 5).answers).toEqual({});
    expect(confirmAnswerIn(kept, QUESTION, 4)).toBe(kept);
  });

  it("changes nothing for a question with no kept answer", () => {
    expect(confirmAnswerIn(NOTHING, QUESTION, 5)).toBe(NOTHING);
  });
});

describe("keptAnswersFor", () => {
  it("gives back the kept answers of the paper's questions, in the paper's order", () => {
    const kept: KeptAttempt = {
      answers: {
        [QUESTION]: answerAt(1),
        "question-b": answerAt(2),
        "question-other-paper": answerAt(3),
      },
    };
    expect(
      keptAnswersFor(kept, ["question-b", QUESTION, "question-c"])
    ).toEqual([
      { answer: answerAt(2), questionId: "question-b" },
      { answer: answerAt(1), questionId: QUESTION },
    ]);
  });

  it("gives back nothing for a paper with no kept answer", () => {
    expect(keptAnswersFor(NOTHING, [QUESTION])).toEqual([]);
  });
});

describe("submittedKeysOf", () => {
  it("names the sitting and the attempt of each row that shows its attempt as submitted", () => {
    expect(
      submittedKeysOf([
        { attempt: "submitted", attemptId: "attempt-a", id: "sitting-a" },
        { attempt: "inProgress", attemptId: "attempt-b", id: "sitting-b" },
        { attempt: null, attemptId: null, id: "sitting-c" },
        { attempt: "closing", attemptId: "attempt-d", id: "sitting-d" },
      ])
    ).toEqual([{ attemptId: "attempt-a", sittingId: "sitting-a" }]);
  });
});

describe("the browser's kept state of an attempt", () => {
  const scoped = <A, E>(
    effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
  ) => Effect.provide(effect, KeyValueStore.layerMemory);

  it.effect("reads nothing kept before the browser keeps anything", () =>
    scoped(
      Effect.gen(function* () {
        expect(yield* readKept(SITTING, ATTEMPT)).toEqual(NOTHING);
      })
    )
  );

  it.effect("keeps an answer until the server confirms it", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepAnswer(SITTING, ATTEMPT, QUESTION, answerAt(7));
        expect((yield* readKept(SITTING, ATTEMPT)).answers).toEqual({
          [QUESTION]: answerAt(7),
        });
        yield* confirmAnswer(SITTING, ATTEMPT, QUESTION, 6);
        expect((yield* readKept(SITTING, ATTEMPT)).answers).toEqual({
          [QUESTION]: answerAt(7),
        });
        yield* confirmAnswer(SITTING, ATTEMPT, QUESTION, 7);
        expect((yield* readKept(SITTING, ATTEMPT)).answers).toEqual({});
      })
    )
  );

  it.effect(
    "keeps typed text from the keystroke, so a field that unmounts without a flush loses no key",
    () =>
      scoped(
        Effect.gen(function* () {
          const typed = {
            answeredAt: 3,
            response: { text: "Jakar" },
            version: 2,
          };
          yield* keepAnswer(SITTING, ATTEMPT, QUESTION, typed);
          // No send and no confirm follow: the next page opens the field with the text and sends it again.
          expect(yield* readKeptResponse(SITTING, ATTEMPT, QUESTION)).toEqual(
            Option.some({ text: "Jakar" })
          );
          expect(
            keptAnswersFor(yield* readKept(SITTING, ATTEMPT), [QUESTION])
          ).toEqual([{ answer: typed, questionId: QUESTION }]);
          expect(
            yield* readKeptResponse(SITTING, ATTEMPT, "question-b")
          ).toEqual(Option.none());
        })
      )
  );

  it.effect("keeps each attempt apart", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepAnswer(SITTING, ATTEMPT, QUESTION, answerAt(1));
        expect(yield* readKept(SITTING, "attempt-b")).toEqual(NOTHING);
      })
    )
  );

  it.effect("forgets everything that it keeps for an attempt", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepAnswer(SITTING, ATTEMPT, QUESTION, answerAt(1));
        yield* forgetAttempt(SITTING, ATTEMPT);
        expect(yield* readKept(SITTING, ATTEMPT)).toEqual(NOTHING);
      })
    )
  );

  it.effect("reads an entry that no longer decodes as nothing kept", () =>
    scoped(
      Effect.gen(function* () {
        const store = yield* KeyValueStore.KeyValueStore;
        yield* store.set(`nakafa-sitting-kept:${SITTING}:${ATTEMPT}`, "{");
        expect(yield* readKept(SITTING, ATTEMPT)).toEqual(NOTHING);
      })
    )
  );
});

describe("settleSent", () => {
  /** Settles one send with a confirm that counts its runs, and returns the outcome and the count. */
  const settled = Effect.fn("test.keep.settled")(function* <E>(
    sent: Effect.Effect<unknown, E>
  ) {
    const confirmed = MutableRef.make(0);
    const outcome = yield* settleSent(
      sent,
      Effect.sync(() => MutableRef.increment(confirmed))
    );
    return { confirmed: MutableRef.get(confirmed), outcome };
  });

  it.effect(
    "confirms the kept answer the server took, and tells of no failure",
    () =>
      Effect.gen(function* () {
        expect(yield* settled(Effect.succeed("saved"))).toEqual({
          confirmed: 1,
          outcome: Option.none(),
        });
      })
  );

  it.effect(
    "confirms the kept answer on a final refusal, and tells of the refusal",
    () =>
      Effect.gen(function* () {
        const stale = { _tag: "StaleAnswer" };
        expect(yield* settled(Effect.fail(stale))).toEqual({
          confirmed: 1,
          outcome: Option.some(stale),
        });
      })
  );

  it.effect(
    "keeps the answer on a lock or another failure, and tells of it",
    () =>
      Effect.gen(function* () {
        for (const failure of [
          { _tag: "SittingLocked" },
          new Error("offline"),
        ]) {
          expect(yield* settled(Effect.fail(failure))).toEqual({
            confirmed: 0,
            outcome: Option.some(failure),
          });
        }
      })
  );
});
