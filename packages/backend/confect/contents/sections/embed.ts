import { embedInput } from "@repo/backend/confect/contents/sections/draft";
import {
  EMBED_BATCH_SIZE,
  EMBED_RETRIES,
  EMBED_RETRY_DELAY_MS,
} from "@repo/backend/confect/contents/sections/limits";
import type { SectionDraft } from "@repo/backend/confect/contents/sections/schema";
import type { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import {
  type EmbeddingModelId,
  embeddingModelId,
} from "@repo/backend/confect/gateway/model";
import { Array as Arr, Duration, Effect, Option, Schedule } from "effect";

/** The vector of one section, or none when the model would not take its text. */
type Vector = Option.Option<readonly number[]>;

/** What an embedder needs of a section: its text, and where it is, which the log names. */
type Embeddable = Pick<
  SectionDraft,
  "appLocale" | "contentKey" | "ordinal" | "text"
>;

/** Whether a new try of the same request may succeed: the gateway says so, or the call ran out of time. */
function transient({ reason, retryable }: GatewayFailure) {
  return retryable === true || reason === "timeout";
}

/** Whether the model refused the request for what it holds, which a new try does not change. */
function refused({ reason }: GatewayFailure) {
  return reason === "invalid" || reason === "too-large";
}

/** Asks the gateway for the vector of each text, and asks again after a failure that may pass. */
const vectorsOf = Effect.fn("contents.sections.vectorsOf")(function* (
  texts: readonly string[],
  model: EmbeddingModelId
) {
  const gateway = yield* Gateway;
  return yield* gateway.embed(texts, model).pipe(
    Effect.retry({
      schedule: Schedule.exponential(Duration.millis(EMBED_RETRY_DELAY_MS)),
      times: EMBED_RETRIES,
      while: transient,
    })
  );
});

/** The vector of one section, or none when the model refuses its text, which the log names. */
const vectorOf = Effect.fn("contents.sections.vectorOf")(function* (
  section: Embeddable,
  model: EmbeddingModelId
) {
  return yield* vectorsOf([embedInput(section.text)], model).pipe(
    Effect.map(Arr.head),
    Effect.catchIf(refused, ({ reason }) =>
      Effect.logWarning(
        "A section could not be embedded and is left out."
      ).pipe(
        Effect.annotateLogs({
          appLocale: section.appLocale,
          contentKey: section.contentKey,
          model,
          ordinal: section.ordinal,
          reason,
        }),
        Effect.as<Vector>(Option.none())
      )
    )
  );
});

/**
 * The vectors of a batch that the model refused, found one text at a time, so
 * that a text the model cannot take is left out and the others still count. A
 * batch of several texts from which none can be taken is not a set of bad
 * texts but a request that is wrong, so it fails with the refusal.
 */
const vectorsOneByOne = Effect.fn("contents.sections.vectorsOneByOne")(
  function* (
    batch: readonly Embeddable[],
    model: EmbeddingModelId,
    refusal: GatewayFailure
  ) {
    const found = yield* Effect.forEach(batch, (section) =>
      vectorOf(section, model)
    );
    if (batch.length > 1 && Arr.every(found, Option.isNone)) {
      return yield* refusal;
    }
    return found;
  }
);

/**
 * The vector of each section of one batch, in order, or none for a section
 * whose text the model refuses. A failure that may pass is tried again, with
 * growing waits, before it ends the call. The build and the model test embed
 * with this one rule, each with the model it works for.
 */
export const embedBatch = Effect.fn("contents.sections.embedBatch")(function* (
  batch: readonly Embeddable[],
  model: EmbeddingModelId = embeddingModelId
) {
  return yield* vectorsOf(
    Arr.map(batch, ({ text }) => embedInput(text)),
    model
  ).pipe(
    Effect.map((vectors) =>
      Arr.map(vectors, (vector): Vector => Option.some(vector))
    ),
    Effect.catchIf(refused, (refusal) => vectorsOneByOne(batch, model, refusal))
  );
});

/**
 * Embeds sections in batches and gives the vector of each, in order, or none
 * for a section whose text the model refuses.
 */
export const embedDrafts = Effect.fn("contents.sections.embedDrafts")(
  function* (drafts: readonly Embeddable[]) {
    return Arr.flatten(
      yield* Effect.forEach(Arr.chunksOf(drafts, EMBED_BATCH_SIZE), (batch) =>
        embedBatch(batch)
      )
    );
  }
);
