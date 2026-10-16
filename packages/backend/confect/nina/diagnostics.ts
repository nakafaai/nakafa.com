import { PostHog } from "@posthog/convex";
import {
  createOperationalException,
  type OperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { languageModel } from "@repo/backend/confect/gateway/model";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { Cause, Effect, Option, Schema } from "effect";

class NinaDiagnosticsError extends Schema.TaggedError<NinaDiagnosticsError>()(
  "NinaDiagnosticsError",
  {}
) {}

/** What PostHog needs of a context to queue an exception: the scheduler that delivers it. */
type Delivery = Parameters<PostHog["captureException"]>[0];

/**
 * Queues the redacted exception of a turn. A queue that fails is logged and
 * lost, so a report never fails the settlement or the run beside it.
 */
const queueException = Effect.fn("nina.diagnostics.queue")(function* (
  ctx: Delivery,
  error: NinaGenerationError,
  properties: OperationalExceptionProperties
) {
  yield* Effect.tryPromise({
    try: () =>
      new PostHog(components.posthog).captureException(ctx, {
        error: createOperationalException(error, properties),
        additionalProperties: properties,
      }),
    catch: () => new NinaDiagnosticsError(),
  }).pipe(
    Effect.catchTag("NinaDiagnosticsError", () =>
      Effect.logWarning("Nina diagnostics could not be queued.")
    )
  );
});

/** Preserve operational routing facts without recording conversation or provider payloads. */
export const reportFailure = Effect.fn("nina.diagnostics.report")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  cause: Cause.Cause<unknown>
) {
  const error = Cause.findErrorOption(cause).pipe(
    Option.filter(Schema.is(NinaGenerationError)),
    Option.getOrElse(() => new NinaGenerationError({ reason: "unknown" }))
  );
  const properties = {
    source: "nina-response",
    operation: error.reason,
    gateway_model_id: languageModel.id,
    gateway_error_type: error.gateway?.type,
    gateway_status_code: error.gateway?.status,
    gateway_retryable: error.gateway?.retryable,
  } satisfies OperationalExceptionProperties;
  yield* Effect.logError("Nina response interrupted", {
    turnId: turn._id,
    ...properties,
  });
  yield* queueException(yield* ActionCtx, error, properties);
});

/**
 * Reports a turn whose run was lost, with the same redaction as a failure in a
 * live run. No run is left to report it, so the settlement that ends the turn
 * does (`closeTurn`), in the mutation that ends it. The log names the turn, the
 * reason it was stored with and how long it was open, in milliseconds. Error
 * tracking gets the reason and the place and, as for a live failure, no turn
 * and no account. Neither gets a word of the conversation: this takes only the
 * id of the turn, a reason from a closed list and a number.
 */
export const reportLostRun = Effect.fn("nina.diagnostics.lost")(function* (
  turn: Pick<NinaTurnsDoc, "_id">,
  reason: NinaGenerationError["reason"],
  openMs: number
) {
  const properties = {
    source: "nina-response",
    operation: reason,
    error_location: "settlement",
  } satisfies OperationalExceptionProperties;
  yield* Effect.logError("Nina run was lost", {
    turnId: turn._id,
    openMs,
    ...properties,
  });
  yield* queueException(
    yield* MutationCtx,
    new NinaGenerationError({ reason }),
    properties
  );
});
