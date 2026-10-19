import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  confirmAnswer,
  confirmAnswerIn,
  flagIn,
  forgetAttempt,
  type KeptAttempt,
  keepAnswer,
  keepAnswerIn,
  keepFlag,
  keptAnswersFor,
  readKept,
} from "@/components/exams/sitting/keep";

const SITTING = "sitting-a";
const ATTEMPT = "attempt-a";
const QUESTION = "question-a";
const NOTHING: KeptAttempt = { answers: {}, flagged: [] };
const RESPONSE = ["option-b"];

/** The answer of one choice, chosen at a device time. */
const answerAt = (answeredAt: number) => ({ answeredAt, response: RESPONSE });

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
      flagged: [],
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

describe("flagIn", () => {
  it("lists a flagged question once, and unlists it", () => {
    const flagged = flagIn(flagIn(NOTHING, QUESTION, true), QUESTION, true);
    expect(flagged.flagged).toEqual([QUESTION]);
    expect(flagIn(flagged, QUESTION, false).flagged).toEqual([]);
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

  it.effect("keeps the flags of an attempt, apart from the answers", () =>
    scoped(
      Effect.gen(function* () {
        yield* keepFlag(SITTING, ATTEMPT, QUESTION, true);
        expect(yield* readKept(SITTING, ATTEMPT)).toEqual({
          answers: {},
          flagged: [QUESTION],
        });
        yield* keepFlag(SITTING, ATTEMPT, QUESTION, false);
        expect((yield* readKept(SITTING, ATTEMPT)).flagged).toEqual([]);
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
        yield* keepFlag(SITTING, ATTEMPT, QUESTION, true);
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
