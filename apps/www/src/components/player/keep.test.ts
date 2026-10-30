import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableRef, Option, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptAnswers, settleSent } from "@/components/player/keep";

const KEY = "kept-attempt-a";
const QUESTION = "question-a";
/** A store whose responses are the option keys a learner picked. */
const store = keptAnswers(Schema.Array(Schema.String));
const kept = store(KEY);

/** The answer of one choice, chosen at a device time and numbered with a version. */
const answerAt = (answeredAt: number, response = ["option-b"]) => ({
  answeredAt,
  response,
  version: 1,
});

const scoped = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

describe("keptAnswers", () => {
  it.effect("reads nothing kept before the browser keeps anything", () =>
    scoped(
      Effect.gen(function* () {
        expect(yield* kept.read()).toEqual({ answers: {} });
        expect(yield* kept.responseOf(QUESTION)).toEqual(Option.none());
      })
    )
  );

  it.effect(
    "keeps an answer in place of the one kept before, until the server confirms it",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* kept.keep(QUESTION, answerAt(6, ["option-a"]));
          yield* kept.keep(QUESTION, answerAt(7));
          expect((yield* kept.read()).answers).toEqual({
            [QUESTION]: answerAt(7),
          });
          expect(yield* kept.responseOf(QUESTION)).toEqual(
            Option.some(["option-b"])
          );
          // The confirm of an earlier answer leaves the later one kept.
          yield* kept.confirm(QUESTION, 6);
          expect((yield* kept.read()).answers).toEqual({
            [QUESTION]: answerAt(7),
          });
          yield* kept.confirm(QUESTION, 7);
          expect((yield* kept.read()).answers).toEqual({});
        })
      )
  );

  it.effect(
    "changes nothing when it confirms a question with no kept answer",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* kept.confirm(QUESTION, 5);
          expect(yield* kept.read()).toEqual({ answers: {} });
        })
      )
  );

  it.effect(
    "gives back the kept answers of the shown questions, in their order",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* kept.keep(QUESTION, answerAt(1));
          yield* kept.keep("question-b", answerAt(2));
          yield* kept.keep("question-other-paper", answerAt(3));
          expect(
            yield* kept.answersFor(["question-b", QUESTION, "question-c"])
          ).toEqual([
            { answer: answerAt(2), questionId: "question-b" },
            { answer: answerAt(1), questionId: QUESTION },
          ]);
        })
      )
  );

  it.effect("keeps each entry apart, and forgets one whole", () =>
    scoped(
      Effect.gen(function* () {
        yield* kept.keep(QUESTION, answerAt(1));
        expect(yield* store("kept-attempt-b").read()).toEqual({ answers: {} });
        yield* kept.forget();
        expect(yield* kept.read()).toEqual({ answers: {} });
      })
    )
  );

  it.effect("reads an entry that no longer decodes as nothing kept", () =>
    scoped(
      Effect.gen(function* () {
        const storage = yield* KeyValueStore.KeyValueStore;
        yield* storage.set(KEY, "{");
        expect(yield* kept.read()).toEqual({ answers: {} });
      })
    )
  );
});

describe("settleSent", () => {
  /** A final refusal in these tests: a stale answer. */
  const isStale = Schema.is(Schema.TaggedStruct("StaleAnswer", {}));

  /** Settles one send with a confirm that counts its runs, and returns the outcome and the count. */
  const settled = Effect.fn("test.keep.settled")(function* <E>(
    sent: Effect.Effect<unknown, E>
  ) {
    const confirmed = MutableRef.make(0);
    const outcome = yield* settleSent(
      sent,
      Effect.sync(() => MutableRef.increment(confirmed)),
      isStale
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

  it.effect("keeps the answer on any other failure, and tells of it", () =>
    Effect.gen(function* () {
      const offline = new Error("offline");
      expect(yield* settled(Effect.fail(offline))).toEqual({
        confirmed: 0,
        outcome: Option.some(offline),
      });
    })
  );
});
