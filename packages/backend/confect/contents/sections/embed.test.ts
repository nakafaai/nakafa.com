import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  embedBatch,
  embedDrafts,
} from "@repo/backend/confect/contents/sections/embed";
import {
  EMBED_BATCH_SIZE,
  EMBED_RETRIES,
} from "@repo/backend/confect/contents/sections/limits";
import type { SectionDraft } from "@repo/backend/confect/contents/sections/schema";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { failures, GatewayTest, provider } from "@repo/backend/test/gateway";
import { MockEmbeddingModelV4 } from "ai/test";
import {
  Array as Arr,
  Effect,
  Fiber,
  Layer,
  Logger,
  MutableRef,
  Option,
} from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

/** The vector that the test embedder gives a text of that many characters. */
const vectorOf = (length: number) =>
  Arr.makeBy(embeddingDimensions, (index) => (index === 0 ? length : 0));

/** A section of the Indonesian lesson of the fixture, told apart by its text and its place. */
function draft(text: string, ordinal = 0): SectionDraft {
  return {
    anchor: `bagian-${ordinal}`,
    appLocale: "id",
    contentKey: "material/lesson/matematika/matriks",
    count: 4,
    excerpt: `Bagian ${ordinal}.`,
    hash: `sha256:${text}`,
    headingPath: [`Bagian ${ordinal}`],
    ordinal,
    publicPath: "materi/matematika/matriks",
    section: "material",
    text,
  };
}

/**
 * An embedder that gives each text the vector of its length. `failure` is what
 * it raises for a call, given the number of the call from one and the texts of
 * it, or nothing for a call that it answers.
 */
function embedder(
  failure: (call: number, values: readonly string[]) => unknown
) {
  const model: MockEmbeddingModelV4 = new MockEmbeddingModelV4({
    doEmbed: ({ values }) => {
      const raised = failure(model.doEmbedCalls.length, values);
      return raised === undefined
        ? Promise.resolve({
            embeddings: Arr.map(values, (value) => vectorOf(value.length)),
            warnings: [],
          })
        : Promise.reject(raised);
    },
    maxEmbeddingsPerCall: 512,
  });
  provider.embeddingModel.mockReturnValue(model);
  return model;
}

const embed = (drafts: readonly SectionDraft[]) =>
  embedDrafts(drafts).pipe(Effect.provide(GatewayTest));

/** Lets the given time pass for the timers of the test, after the fibers have run up to them. */
const pass = (milliseconds: number) =>
  Effect.promise(() => vi.advanceTimersByTimeAsync(milliseconds));

describe("section embedding", () => {
  it.live("gives the vector of each draft in order, a batch at a time", () =>
    Effect.gen(function* () {
      const model = embedder(() => undefined);
      const drafts = Arr.makeBy(EMBED_BATCH_SIZE + 1, (index) =>
        draft("t".repeat(index + 1), index)
      );
      expect(yield* embed(drafts)).toEqual(
        Arr.makeBy(EMBED_BATCH_SIZE + 1, (index) =>
          Option.some(vectorOf(index + 1))
        )
      );
      expect(
        Arr.map(model.doEmbedCalls, ({ values }) => values.length)
      ).toEqual([EMBED_BATCH_SIZE, 1]);
    })
  );

  it.live(
    "embeds a batch with the model it is given, and the build with its own",
    () =>
      Effect.gen(function* () {
        embedder(() => undefined);
        yield* embedBatch([draft("abc")], "qwen/qwen3-embedding-8b").pipe(
          Effect.provide(GatewayTest)
        );
        expect(provider.embeddingModel).toHaveBeenLastCalledWith(
          "qwen/qwen3-embedding-8b",
          { zdr: true }
        );
        yield* embed([draft("abc")]);
        expect(provider.embeddingModel).toHaveBeenLastCalledWith(
          "google/gemini-embedding-2",
          { zdr: true }
        );
      })
  );

  it.live("asks again after a failure that may pass, with growing waits", () =>
    Effect.gen(function* () {
      const model = embedder((call) =>
        call <= 2 ? failures.unavailable : undefined
      );
      const fiber = yield* Effect.forkChild(embed([draft("abc")]));
      yield* pass(4999);
      expect(model.doEmbedCalls).toHaveLength(1);
      yield* pass(1);
      expect(model.doEmbedCalls).toHaveLength(2);
      yield* pass(9999);
      expect(model.doEmbedCalls).toHaveLength(2);
      yield* pass(1);
      expect(model.doEmbedCalls).toHaveLength(3);
      expect(yield* Fiber.join(fiber)).toEqual([Option.some(vectorOf(3))]);
    })
  );

  it.live("asks again after a call that ran out of time", () =>
    Effect.gen(function* () {
      const model = embedder((call) =>
        call === 1 ? new GatewayFailure({ reason: "timeout" }) : undefined
      );
      const fiber = yield* Effect.forkChild(embed([draft("abc")]));
      yield* pass(5000);
      expect(yield* Fiber.join(fiber)).toEqual([Option.some(vectorOf(3))]);
      expect(model.doEmbedCalls).toHaveLength(2);
    })
  );

  it.live("gives up after the last new try and fails with the failure", () =>
    Effect.gen(function* () {
      const model = embedder(() => failures.unavailable);
      const fiber = yield* Effect.forkChild(Effect.flip(embed([draft("abc")])));
      // The waits are 5, 10, 20, and 40 seconds.
      yield* pass(75_000);
      expect(yield* Fiber.join(fiber)).toBe(failures.unavailable);
      expect(model.doEmbedCalls).toHaveLength(EMBED_RETRIES + 1);
    })
  );

  it.live("does not ask again after a failure that no new try changes", () =>
    Effect.gen(function* () {
      const model = embedder(() => failures.auth);
      expect(yield* Effect.flip(embed([draft("abc")]))).toBe(failures.auth);
      expect(model.doEmbedCalls).toHaveLength(1);
    })
  );

  describe("a text that the model refuses", () => {
    const poison = "BAD";
    const refusing = (refusal: GatewayFailure) =>
      embedder((_call, values) =>
        Arr.some(values, (value) => value.includes(poison))
          ? refusal
          : undefined
      );

    // The table names the refusals, because the table copies what it holds
    // and a copy of a failure is not the failure.
    it.live.each(["invalid", "too-large"] as const)(
      "is left out when the refusal is %s, and the others still count",
      (reason) =>
        Effect.gen(function* () {
          const refusal = failures[reason];
          const model = refusing(refusal);
          const logged = MutableRef.make<readonly unknown[]>([]);
          const found = yield* embedDrafts([
            draft("a", 0),
            draft(poison, 1),
            draft("abc", 2),
          ]).pipe(
            Effect.provide(
              Layer.mergeAll(
                GatewayTest,
                Logger.layer([
                  Logger.formatStructured.pipe(
                    Logger.map(({ annotations, level, message }) =>
                      MutableRef.update(
                        logged,
                        Arr.append({ annotations, level, message })
                      )
                    )
                  ),
                ])
              )
            )
          );
          expect(found).toEqual([
            Option.some(vectorOf(1)),
            Option.none(),
            Option.some(vectorOf(3)),
          ]);
          // The batch, then each text of it alone.
          expect(model.doEmbedCalls).toHaveLength(4);
          expect(MutableRef.get(logged)).toEqual([
            {
              annotations: {
                appLocale: "id",
                contentKey: "material/lesson/matematika/matriks",
                model: "google/gemini-embedding-2",
                ordinal: 1,
                reason: refusal.reason,
              },
              level: "WARN",
              message: "A section could not be embedded and is left out.",
            },
          ]);
        })
    );

    it.live("leaves out a draft that comes alone", () =>
      Effect.gen(function* () {
        refusing(failures.invalid);
        expect(yield* embed([draft(poison)])).toEqual([Option.none()]);
      })
    );

    it.live(
      "fails with the refusal when the model takes none of a batch, because the request is wrong",
      () =>
        Effect.gen(function* () {
          const model = embedder(() => failures.invalid);
          expect(
            yield* Effect.flip(embed([draft("a", 0), draft("b", 1)]))
          ).toBe(failures.invalid);
          expect(model.doEmbedCalls).toHaveLength(3);
        })
    );
  });
});
