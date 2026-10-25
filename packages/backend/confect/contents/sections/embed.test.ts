import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { embedBatch } from "@repo/backend/confect/contents/sections/embed";
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
  embedBatch(drafts).pipe(Effect.provide(GatewayTest));

/** A layer that keeps each log line that is written, with its level, message, and annotations. */
const keepingLogs = (logged: MutableRef.MutableRef<readonly unknown[]>) =>
  Logger.layer([
    Logger.formatStructured.pipe(
      Logger.map(({ annotations, level, message }) =>
        MutableRef.update(logged, Arr.append({ annotations, level, message }))
      )
    ),
  ]);

/**
 * Embeds a batch as `embed` does, and gives its answer with the log lines that
 * the embedding wrote, each with its level, message, and annotations.
 */
const embedLogged = (drafts: readonly SectionDraft[]) => {
  const logged = MutableRef.make<readonly unknown[]>([]);
  return Effect.map(
    embedBatch(drafts).pipe(
      Effect.provide(Layer.mergeAll(GatewayTest, keepingLogs(logged)))
    ),
    (found) => ({ found, logged: MutableRef.get(logged) })
  );
};

/**
 * Embeds a batch that must fail, as `embed` does, and gives its failure with the
 * log lines that the embedding wrote.
 */
const failedLogged = (drafts: readonly SectionDraft[]) => {
  const logged = MutableRef.make<readonly unknown[]>([]);
  return Effect.map(
    Effect.flip(
      embedBatch(drafts).pipe(
        Effect.provide(Layer.mergeAll(GatewayTest, keepingLogs(logged)))
      )
    ),
    (failure) => ({ failure, logged: MutableRef.get(logged) })
  );
};

/** Lets the given time pass for the timers of the test, after the fibers have run up to them. */
const pass = (milliseconds: number) =>
  Effect.promise(() => vi.advanceTimersByTimeAsync(milliseconds));

describe("section embedding", () => {
  it.live(
    "gives the vector of each draft in order, one request for each text",
    () =>
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
        expect(model.doEmbedCalls).toHaveLength(EMBED_BATCH_SIZE + 1);
        expect(
          Arr.every(model.doEmbedCalls, ({ values }) => values.length === 1)
        ).toBe(true);
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

  it.live(
    "gives up on the text after the last new try, and when the probe text fails too, fails with the failure of the text",
    () =>
      Effect.gen(function* () {
        const model = embedder(() => failures.unavailable);
        const fiber = yield* Effect.forkChild(
          Effect.flip(embed([draft("abc")]))
        );
        // The waits are 5, 10, 20, and 40 seconds for the text, and as much for the probe text.
        yield* pass(75_000);
        yield* pass(75_000);
        expect(yield* Fiber.join(fiber)).toBe(failures.unavailable);
        expect(model.doEmbedCalls).toHaveLength(2 * (EMBED_RETRIES + 1));
      })
  );

  it.live(
    "does not ask the text again after a failure that no new try changes, and asks the probe text once",
    () =>
      Effect.gen(function* () {
        const model = embedder(() => failures.auth);
        expect(yield* Effect.flip(embed([draft("abc")]))).toBe(failures.auth);
        // The text, and then the probe text, which the model fails the same way.
        expect(model.doEmbedCalls).toHaveLength(2);
      })
  );

  it.live(
    "fails with a failure that is not a refusal, such as a configuration failure, when the probe text fails too",
    () =>
      Effect.gen(function* () {
        // A status of 404 is not a refusal of the text, so the text is not left
        // out on its own: the probe text decides, and here it fails as well.
        const model = embedder(() => failures.configuration);
        expect(yield* Effect.flip(embed([draft("abc")]))).toBe(
          failures.configuration
        );
        expect(model.doEmbedCalls).toHaveLength(2);
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
          const { found, logged } = yield* embedLogged([
            draft("a", 0),
            draft(poison, 1),
            draft("abc", 2),
          ]);
          expect(found).toEqual([
            Option.some(vectorOf(1)),
            Option.none(),
            Option.some(vectorOf(3)),
          ]);
          // Each text goes in a request of its own, and the model takes two
          // of them, so no probe is sent.
          expect(model.doEmbedCalls).toHaveLength(3);
          expect(logged).toEqual([
            {
              annotations: {
                appLocale: "id",
                bytes: 3,
                characters: 3,
                contentKey: "material/lesson/matematika/matriks",
                model: "google/gemini-embedding-2",
                ordinal: 1,
                reason: refusal.reason,
                retryable: refusal.retryable,
                status: refusal.status,
                type: refusal.type,
              },
              level: "WARN",
              message: "A section could not be embedded and is left out.",
            },
          ]);
        })
    );

    it.live(
      "leaves out a draft that comes alone, when the model takes the probe text",
      () =>
        Effect.gen(function* () {
          const model = refusing(failures.invalid);
          expect(yield* embed([draft(poison)])).toEqual([Option.none()]);
          // The text, and then the probe text, which the model takes.
          expect(model.doEmbedCalls).toHaveLength(2);
        })
    );

    it.live(
      "leaves out each text of a batch that the model refuses, when it takes the probe text",
      () =>
        Effect.gen(function* () {
          const model = refusing(failures.invalid);
          expect(
            yield* embed([draft(poison, 0), draft(`${poison} again`, 1)])
          ).toEqual([Option.none(), Option.none()]);
          // The two texts, and the probe text.
          expect(model.doEmbedCalls).toHaveLength(3);
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
          // The two texts, and the probe text that the model refuses too.
          expect(model.doEmbedCalls).toHaveLength(3);
        })
    );

    it.live(
      "fails with the refusal, and warns of no section left out, when the model takes none of a batch and the probe text fails too",
      () =>
        Effect.gen(function* () {
          embedder(() => failures.invalid);
          const { failure, logged } = yield* failedLogged([
            draft("a", 0),
            draft("b", 1),
          ]);
          expect(failure).toBe(failures.invalid);
          // The call fails, so no section is left out, and no line says that one is.
          expect(logged).toEqual([]);
        })
    );
  });

  describe("a text that fails for another reason than a refusal", () => {
    const poison = "BAD";
    /** An embedder that fails every request with the failure for the poisoned text, and takes the probe text. */
    const failingText = (failure: GatewayFailure) =>
      embedder((_call, values) =>
        Arr.some(values, (value) => value.includes(poison))
          ? failure
          : undefined
      );

    it.live(
      "leaves out a text that the model cannot embed when it takes the probe text, and warns with its failure",
      () =>
        Effect.gen(function* () {
          const model = failingText(failures.configuration);
          const { found, logged } = yield* embedLogged([
            draft("a", 0),
            draft(poison, 1),
            draft("abc", 2),
          ]);
          expect(found).toEqual([
            Option.some(vectorOf(1)),
            Option.none(),
            Option.some(vectorOf(3)),
          ]);
          // Each text goes in a request of its own, and the text that fails is
          // followed by one probe text, which the model takes.
          expect(model.doEmbedCalls).toHaveLength(4);
          expect(
            Arr.filter(model.doEmbedCalls, ({ values }) =>
              Arr.contains(values, "Nakafa")
            )
          ).toHaveLength(1);
          expect(logged).toEqual([
            {
              annotations: {
                appLocale: "id",
                bytes: 3,
                characters: 3,
                contentKey: "material/lesson/matematika/matriks",
                model: "google/gemini-embedding-2",
                ordinal: 1,
                reason: "configuration",
                retryable: false,
                status: 404,
              },
              level: "WARN",
              message: "A section could not be embedded and is left out.",
            },
          ]);
        })
    );

    it.live(
      "leaves out a draft that comes alone once, with one probe text and no probe for the batch",
      () =>
        Effect.gen(function* () {
          const model = failingText(failures.configuration);
          expect(yield* embed([draft(poison)])).toEqual([Option.none()]);
          // The text, and then the probe text, which the model takes.
          expect(model.doEmbedCalls).toHaveLength(2);
        })
    );

    it.live(
      "leaves out a text that fails after its new tries, when the model takes the probe text",
      () =>
        Effect.gen(function* () {
          const model = failingText(failures.unavailable);
          const fiber = yield* Effect.forkChild(
            embed([draft("a", 0), draft(poison, 1)])
          );
          // The text gets its new tries, which wait 5, 10, 20, and 40 seconds.
          yield* pass(75_000);
          expect(yield* Fiber.join(fiber)).toEqual([
            Option.some(vectorOf(1)),
            Option.none(),
          ]);
          // The first text, the text with its new tries, and the probe text.
          expect(model.doEmbedCalls).toHaveLength(1 + (EMBED_RETRIES + 1) + 1);
        })
    );
  });
});
