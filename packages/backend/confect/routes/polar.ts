import { webhooks } from "@polar-sh/sdk/2026-10";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { PolarPayloadError } from "@repo/backend/confect/billing/polar/payload";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/confect/routes/constants";
import { Config, Effect, Record as Rec, Redacted, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

class PolarWebhookReadError extends Schema.TaggedError<PolarWebhookReadError>()(
  "PolarWebhookReadError",
  {
    message: Schema.String,
  }
) {}
class PolarWebhookVerificationError extends Schema.TaggedError<PolarWebhookVerificationError>()(
  "PolarWebhookVerificationError",
  {
    message: Schema.String,
  }
) {}
/** A correctly signed event whose type the SDK does not know; acknowledged so Polar stops retrying it. */
class PolarWebhookUnknownEventError extends Schema.TaggedError<PolarWebhookUnknownEventError>()(
  "PolarWebhookUnknownEventError",
  {
    message: Schema.String,
  }
) {}
class PolarWebhookSdkError extends Schema.TaggedError<PolarWebhookSdkError>()(
  "PolarWebhookSdkError",
  {
    message: Schema.String,
  }
) {}

/** Reads the body through the Effect error channel. */
const readPolarWebhookBody = Effect.fn("routes.polar.readBody")(
  (request: Request) =>
    Effect.tryPromise({
      catch: (error) =>
        new PolarWebhookReadError({
          message: getUnknownErrorMessage(error),
        }),
      try: () => request.text(),
    })
);

/** Maps the SDK's rejections onto the responses the route returns for them. */
function toVerificationError(error: unknown) {
  const message = getUnknownErrorMessage(error);
  if (error instanceof webhooks.PolarWebhookVerificationError) {
    return new PolarWebhookVerificationError({ message });
  }
  if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
    // Without a string event type the body is malformed; a string type the SDK
    // does not know is an event Nakafa acknowledges.
    if (error.eventType === null) {
      return new PolarPayloadError({ cause: error, message });
    }
    return new PolarWebhookUnknownEventError({ message });
  }
  // Any other rejection, including a body that is not JSON, is an SDK failure.
  return new PolarWebhookSdkError({ message });
}

/** The delivery headers every Standard Webhooks delivery carries. A request without them is refused before its signature is read. */
const PolarDeliveryHeaders = Schema.Struct({
  "webhook-id": Schema.NonEmptyString,
  "webhook-timestamp": Schema.NonEmptyString,
});

/** Reads the delivery headers, or refuses the request when Polar did not send them. */
const readDeliveryHeaders = Effect.fn("routes.polar.deliveryHeaders")(
  function* (headers: Record<string, string>) {
    return yield* Schema.decodeUnknownEffect(PolarDeliveryHeaders)(
      headers
    ).pipe(
      Effect.mapError(
        () =>
          new PolarWebhookVerificationError({
            message: "Polar webhook is missing its delivery headers.",
          })
      )
    );
  }
);

/** Verifies the signature and decodes the SDK payload without throwing. */
const verifyPolarWebhook = Effect.fn("routes.polar.verify")(function* (
  body: string,
  headers: Record<string, string>
) {
  // A missing secret is a deployment fault, so it reaches the route's cause handler.
  const secret = yield* Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    "POLAR_WEBHOOK_SECRET"
  );
  return yield* Effect.tryPromise({
    catch: toVerificationError,
    try: () => webhooks.validateEvent(body, headers, Redacted.value(secret)),
  });
});

/**
 * Receives one Polar webhook. The route verifies its signature, stores the
 * delivery in the inbox keyed by the Standard Webhooks delivery ID, and answers
 * 2xx, so Polar stops retrying. A redelivery of a stored delivery changes nothing.
 */
export const polarRoutes = HttpRouter.add(
  "POST",
  "/polar/events",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const body = yield* readPolarWebhookBody(request);
    const headers = Rec.fromEntries(request.headers.entries());
    const delivery = yield* readDeliveryHeaders(headers);
    const event = yield* verifyPolarWebhook(body, headers);
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(refs.internal.billing.events.record, {
      rail: "polar",
      key: delivery["webhook-id"],
      type: event.type,
      providerTime: Number(delivery["webhook-timestamp"]) * 1000,
      payload: body,
    }).pipe(Effect.orDie);
    return HttpServerResponse.text("Accepted", {
      status: HTTP_ACCEPTED,
    });
  }).pipe(
    Effect.catchTags({
      PolarPayloadError: (error) =>
        Effect.logWarning("Polar webhook payload rejected").pipe(
          Effect.annotateLogs({
            error: error.message,
          }),
          Effect.as(
            HttpServerResponse.text("Bad Request", {
              status: HTTP_BAD_REQUEST,
            })
          )
        ),
      PolarWebhookReadError: (error) =>
        Effect.logError("Polar webhook body read failed", error).pipe(
          Effect.as(
            HttpServerResponse.text("Internal server error", {
              status: HTTP_INTERNAL_ERROR,
            })
          )
        ),
      PolarWebhookSdkError: (error) =>
        Effect.logError("Polar webhook SDK failed", error).pipe(
          Effect.as(
            HttpServerResponse.text("Internal server error", {
              status: HTTP_INTERNAL_ERROR,
            })
          )
        ),
      PolarWebhookUnknownEventError: (error) =>
        Effect.logWarning("Polar webhook event type is unknown").pipe(
          Effect.annotateLogs({
            error: error.message,
          }),
          Effect.as(HttpServerResponse.empty({ status: HTTP_ACCEPTED }))
        ),
      PolarWebhookVerificationError: (error) =>
        Effect.logWarning("Polar webhook verification failed").pipe(
          Effect.annotateLogs({
            error: error.message,
          }),
          Effect.as(
            HttpServerResponse.text("Forbidden", {
              status: HTTP_FORBIDDEN,
            })
          )
        ),
    }),
    Effect.catchCause((cause) =>
      Effect.logError("Polar webhook processing failed", cause).pipe(
        Effect.as(
          HttpServerResponse.text("Internal server error", {
            status: HTTP_INTERNAL_ERROR,
          })
        )
      )
    )
  )
);
