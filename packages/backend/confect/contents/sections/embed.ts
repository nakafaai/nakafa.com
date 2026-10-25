import { embedInput } from "@repo/backend/confect/contents/sections/draft";
import {
  EMBED_CONCURRENCY,
  EMBED_RETRIES,
  EMBED_RETRY_DELAY_MS,
} from "@repo/backend/confect/contents/sections/limits";
import type { SectionDraft } from "@repo/backend/confect/contents/sections/schema";
import {
  type GatewayFailure,
  routingFacts,
} from "@repo/backend/confect/gateway/failure";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import {
  type EmbeddingModelId,
  embeddingModelId,
} from "@repo/backend/confect/gateway/model";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Result,
  Schedule,
} from "effect";

/** The vector of one text, or none when the model answered with no vector. */
type Vector = Option.Option<readonly number[]>;

/** What an embedder needs of a section: its text, and where it is, which the log names. */
type Embeddable = Pick<
  SectionDraft,
  "appLocale" | "contentKey" | "ordinal" | "text"
>;

/**
 * A text that every model takes. When the model refuses every text of a batch,
 * this text tells a model that refuses everything from a batch of refused texts.
 * When another failure outlasts its new tries, this text tells a text that the
 * model cannot embed from a gateway that cannot embed anything.
 */
const PROBE_TEXT = "Nakafa";

/** Whether a new try of the same request may succeed: the gateway says so, or the call ran out of time. */
function transient({ reason, retryable }: GatewayFailure) {
  return retryable === true || reason === "timeout";
}

/** Whether the model refused the request for what it holds, which a new try does not change. */
function refused({ reason }: GatewayFailure) {
  return reason === "invalid" || reason === "too-large";
}

/** The UTF-8 bytes of a text, which the log names with its size. */
const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;

/**
 * The vector of one text, from one request, asked again after a failure that
 * may pass.
 */
const vectorOfText = Effect.fn("contents.sections.vectorOfText")(function* (
  text: string,
  model: EmbeddingModelId
) {
  const gateway = yield* Gateway;
  return yield* gateway.embed([text], model).pipe(
    Effect.map(Arr.head),
    Effect.retry({
      schedule: Schedule.exponential(Duration.millis(EMBED_RETRY_DELAY_MS)),
      times: EMBED_RETRIES,
      while: transient,
    })
  );
});

/** The facts that name a section in the log: where it is, and the size of the text that the model is given. */
function factsOf(section: Embeddable, text: string, model: EmbeddingModelId) {
  return {
    appLocale: section.appLocale,
    bytes: bytesOf(text),
    characters: text.length,
    contentKey: section.contentKey,
    model,
    ordinal: section.ordinal,
  };
}

type Facts = ReturnType<typeof factsOf>;

/** Logs that a section is left out of the index, with the routing facts of the failure that left it out. */
const leaveOut = (facts: Facts, failure: GatewayFailure) =>
  Effect.logWarning("A section could not be embedded and is left out.").pipe(
    Effect.annotateLogs({ ...facts, ...routingFacts(failure) })
  );

/**
 * The answer for one section. A text that the model refuses is a failure with the
 * facts that name the section, which its batch judges. Any other failure that
 * outlasts its new tries is probed on its own: when the model takes the probe
 * text, the section is a success with no vector, which leaves it out, and when
 * the probe fails too, the call fails with the failure of the section, so a
 * gateway outage still stops the build.
 */
const answerOf = Effect.fn("contents.sections.answerOf")(function* (
  section: Embeddable,
  model: EmbeddingModelId
) {
  const text = embedInput(section.text);
  const facts = factsOf(section, text, model);
  const answer = yield* Effect.result(vectorOfText(text, model));
  if (Result.isSuccess(answer)) {
    return Result.succeed(answer.success);
  }
  const failure = answer.failure;
  if (refused(failure)) {
    return Result.fail({ facts, failure });
  }
  const probe = yield* Effect.result(vectorOfText(PROBE_TEXT, model));
  if (Result.isFailure(probe)) {
    yield* Effect.logError("An embedding request failed.").pipe(
      Effect.annotateLogs({ ...facts, ...routingFacts(failure) })
    );
    return yield* failure;
  }
  yield* leaveOut(facts, failure);
  return Result.succeed(Option.none());
});

/**
 * The vector of each section of a batch, in order, or none for a section that
 * is left out of the index (see `answerOf`). Each text goes in a request of its
 * own, because the gateway refuses a request of several texts for the embedding
 * model (see `EMBED_CONCURRENCY`), and several requests run at once. When the
 * model refuses every text of a batch, the probe text decides: when the model
 * takes the probe, the refused texts are left out, and when the probe fails, the
 * call fails with that failure. The build and the model test embed with this one
 * rule, each with the model it works for.
 */
export const embedBatch = Effect.fn("contents.sections.embedBatch")(function* (
  batch: readonly Embeddable[],
  model: EmbeddingModelId = embeddingModelId
) {
  const answers = yield* Effect.forEach(
    batch,
    (section) => answerOf(section, model),
    { concurrency: EMBED_CONCURRENCY }
  );
  if (batch.length > 0 && Arr.every(answers, Result.isFailure)) {
    yield* vectorOfText(PROBE_TEXT, model);
  }
  // The refused texts are logged as left out only now, when the batch has decided
  // that they are: a call that fails with the probe text leaves out nothing.
  return yield* Effect.forEach(answers, (answer): Effect.Effect<Vector> => {
    if (Result.isFailure(answer)) {
      const { facts, failure } = answer.failure;
      return leaveOut(facts, failure).pipe(Effect.as(Option.none()));
    }
    return Effect.succeed(answer.success);
  });
});
