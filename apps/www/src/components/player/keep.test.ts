import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Layer,
  MutableRef,
  Option,
  Order,
  Record as Rec,
  Schema,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import { TestClock } from "effect/testing";
import { keptAnswers } from "@/components/player/keep";

const doubles = vi.hoisted(() => ({
  captureException: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: doubles.captureException,
}));
vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: doubles.toastError },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const KEY = "kept-attempt-a";
const QUESTION = "question-a";
/** A store whose responses are the option keys a learner picked. */
const store = keptAnswers(Schema.Array(Schema.String));
const kept = store(KEY);

/** The answer of one choice, numbered with a version. */
const answer = (response = ["option-b"], version = 1) => ({
  response,
  version,
});

/** The same answer as the entry keeps it, chosen at a device time. */
const keptAt = (answeredAt: number, response = ["option-b"], version = 1) => ({
  answeredAt,
  response,
  version,
});

const scoped = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

/** A browser that refuses every call to its storage. */
const refusing = Layer.succeed(KeyValueStore.KeyValueStore)(
  KeyValueStore.makeStringOnly({
    clear: Effect.fail(refusal("clear")),
    get: () => Effect.fail(refusal("get")),
    keys: Effect.fail(refusal("keys")),
    remove: () => Effect.fail(refusal("remove")),
    set: () => Effect.fail(refusal("set")),
    size: Effect.fail(refusal("size")),
  })
);

function refusal(method: string) {
  return new KeyValueStore.KeyValueStoreError({
    message: "Refused.",
    method,
  });
}

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
    "keeps an answer at the device time in place of the one kept before, until the server confirms it",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* TestClock.setTime(6);
          yield* kept.keep(QUESTION, answer(["option-a"]));
          yield* TestClock.setTime(7);
          expect(yield* kept.keep(QUESTION, answer())).toEqual(keptAt(7));
          expect((yield* kept.read()).answers).toEqual({
            [QUESTION]: keptAt(7),
          });
          expect(yield* kept.responseOf(QUESTION)).toEqual(
            Option.some(["option-b"])
          );
          // The confirm of an earlier answer leaves the later one kept.
          yield* kept.confirm(QUESTION, 6);
          expect((yield* kept.read()).answers).toEqual({
            [QUESTION]: keptAt(7),
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
          yield* kept.keep(QUESTION, answer(["option-a"]));
          yield* kept.keep("question-b", answer());
          yield* kept.keep("question-other-paper", answer());
          expect(
            yield* kept.answersFor(["question-b", QUESTION, "question-c"])
          ).toEqual([
            { answer: keptAt(0), questionId: "question-b" },
            { answer: keptAt(0, ["option-a"]), questionId: QUESTION },
          ]);
        })
      )
  );

  it.effect("keeps each entry apart, and forgets one whole", () =>
    scoped(
      Effect.gen(function* () {
        yield* kept.keep(QUESTION, answer());
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

describe("the bound ledger", () => {
  /** A failure a product names, read as the refusal it carries. */
  const Failure = Schema.Struct({
    refusal: Schema.Literals(["failed", "final", "held", "quiet"]),
  });
  type Failure = typeof Failure.Type;

  /** The toast of each refusal, so a test reads which failure a toast came from. */
  const copies = {
    failed: { title: "action-error.title" },
    final: { title: "sitting-attempt-closed.title" },
    held: { title: "sitting-attempt-locked.title" },
    quiet: { title: "sitting-not-in.title" },
  } as const;

  /** A ledger whose sends answer in turn from `outcomes`: a failure, or none for a save the server took. */
  function ledger(outcomes: readonly Option.Option<Failure>[]) {
    const sent = MutableRef.make<readonly unknown[]>([]);
    const bound = kept.bind({
      copyOf: (failure: Failure) => copies[failure.refusal],
      refusal: (failure: Failure) => failure.refusal,
      send: (questionId: string, sending) =>
        Effect.suspend(() => {
          const outcome = Option.flatten(
            Arr.get(outcomes, MutableRef.get(sent).length)
          );
          MutableRef.update(sent, Arr.append({ questionId, ...sending }));
          return Option.match(outcome, {
            onNone: () => Effect.void,
            onSome: Effect.fail,
          });
        }),
      source: "test/ledger",
    });
    return { bound, sent: () => MutableRef.get(sent) };
  }

  const took = Option.none<Failure>();
  const failed = (refusal: Failure["refusal"]) => Option.some({ refusal });

  it.effect(
    "keeps a chosen answer before it sends it, and drops it once the server takes it, telling nothing",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* TestClock.setTime(4);
          const { bound, sent } = ledger([took]);
          yield* bound.choose(QUESTION, answer());

          expect(sent()).toEqual([{ questionId: QUESTION, ...answer() }]);
          expect(yield* kept.read()).toEqual({ answers: {} });
          expect(doubles.toastError).not.toHaveBeenCalled();
        })
      )
  );

  it.effect(
    "drops an answer the server will never take, telling only of a final refusal",
    () =>
      scoped(
        Effect.gen(function* () {
          const { bound } = ledger([failed("quiet"), failed("final")]);
          yield* bound.choose(QUESTION, answer());
          yield* bound.choose("question-b", answer());

          expect(yield* kept.read()).toEqual({ answers: {} });
          expect(doubles.toastError).toHaveBeenCalledExactlyOnceWith(
            copies.final,
            { position: "bottom-center" }
          );
          expect(doubles.captureException).not.toHaveBeenCalled();
        })
      )
  );

  it.effect(
    "keeps an answer a lock holds or a failed call lost, and reports only the failure that names no refusal",
    () =>
      scoped(
        Effect.gen(function* () {
          const { bound } = ledger([failed("held"), failed("failed")]);
          yield* bound.choose(QUESTION, answer());
          yield* bound.choose("question-b", answer(["option-c"]));

          expect(yield* kept.answersFor([QUESTION, "question-b"])).toEqual([
            { answer: keptAt(0), questionId: QUESTION },
            { answer: keptAt(0, ["option-c"]), questionId: "question-b" },
          ]);
          expect(doubles.toastError).toHaveBeenCalledTimes(2);
          expect(doubles.captureException).toHaveBeenCalledExactlyOnceWith(
            { refusal: "failed" },
            { source: "test/ledger" }
          );
        })
      )
  );

  it.effect(
    "sends the kept answers of the shown questions again and tells of the pass's failures with one toast",
    () =>
      scoped(
        Effect.gen(function* () {
          yield* kept.keep(QUESTION, answer());
          yield* kept.keep("question-b", answer(["option-c"]));
          yield* kept.keep("question-c", answer(["option-d"]));
          yield* kept.keep("question-other-paper", answer());
          const { bound, sent } = ledger([
            failed("quiet"),
            failed("held"),
            failed("failed"),
          ]);

          const told = yield* bound.resend([
            QUESTION,
            "question-b",
            "question-c",
          ]);

          expect(sent()).toHaveLength(3);
          expect(told).toEqual([{ refusal: "held" }, { refusal: "failed" }]);
          expect(doubles.toastError).toHaveBeenCalledExactlyOnceWith(
            copies.held,
            { position: "bottom-center" }
          );
          expect(
            Arr.sort(Rec.keys((yield* kept.read()).answers), Order.String)
          ).toEqual(["question-b", "question-c", "question-other-paper"]);
        })
      )
  );

  it.effect(
    "still sends a chosen answer from a browser that refuses its storage, and reports the refusals",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(9);
        const { bound, sent } = ledger([took]);
        yield* bound.choose(QUESTION, answer());
        const told = yield* bound.resend([QUESTION]);

        expect(sent()).toEqual([{ questionId: QUESTION, ...answer() }]);
        expect(told).toEqual([]);
        // The keep, the confirm, and the read of the pass each report the refused storage.
        expect(doubles.captureException).toHaveBeenCalledTimes(3);
        expect(doubles.toastError).not.toHaveBeenCalled();
      }).pipe(Effect.provide(refusing))
  );
});
