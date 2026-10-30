import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptAttempt, submittedKeysOf } from "@/components/exams/sitting/keep";

const SITTING = "sitting-a";
const ATTEMPT = "attempt-a";
const QUESTION = "question-a";

const scoped = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

describe("keptAttempt", () => {
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
          yield* keptAttempt(SITTING, ATTEMPT).keep(QUESTION, typed);
          // No send and no confirm follow: the next page opens the field with the text and sends it again.
          const reloaded = keptAttempt(SITTING, ATTEMPT);
          expect(yield* reloaded.responseOf(QUESTION)).toEqual(
            Option.some({ text: "Jakar" })
          );
          expect(yield* reloaded.answersFor([QUESTION])).toEqual([
            { answer: typed, questionId: QUESTION },
          ]);
        })
      )
  );

  it.effect("keeps each attempt of a sitting apart", () =>
    scoped(
      Effect.gen(function* () {
        yield* keptAttempt(SITTING, ATTEMPT).keep(QUESTION, {
          answeredAt: 1,
          response: ["option-b"],
          version: 1,
        });
        expect(yield* keptAttempt(SITTING, "attempt-b").read()).toEqual({
          answers: {},
        });
      })
    )
  );
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
