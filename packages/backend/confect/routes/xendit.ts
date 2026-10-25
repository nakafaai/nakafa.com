import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import {
  sameCallbackToken,
  XenditTokenRejected,
  XenditWebhookEnvelope,
  xenditDeliveryKey,
} from "@repo/backend/confect/billing/xendit/webhook";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/confect/routes/constants";
import { Config, DateTime, Effect, Redacted, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** The body could not be read, or it is not a Xendit webhook envelope. */
class XenditRouteMalformed extends Schema.TaggedError<XenditRouteMalformed>()(
  "XenditRouteMalformed",
  {
    message: Schema.String,
  }
) {}

/**
 * Receives one Xendit webhook. The route checks the callback token, stores the
 * delivery in the inbox and schedules its processing, and answers 2xx, so Xendit
 * stops retrying. A redelivery of a stored delivery changes nothing.
 */
export const xenditRoutes = HttpRouter.add(
  "POST",
  "/xendit/events",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const expected = yield* Config.schema(
      Schema.Redacted(Schema.NonEmptyString),
      "XENDIT_WEBHOOK_SECRET"
    );
    const received = request.headers.get("x-callback-token") ?? "";
    if (!sameCallbackToken(received, Redacted.value(expected))) {
      return yield* new XenditTokenRejected({});
    }
    // A body that cannot be read is a transport failure, not a malformed webhook. It is a
    // defect: the catch below logs its cause and answers 500, so Xendit retries the delivery.
    const body = yield* Effect.promise(() => request.text());
    const envelope = yield* Schema.decodeEffect(
      Schema.fromJsonString(XenditWebhookEnvelope)
    )(body).pipe(
      Effect.mapError(
        (error) => new XenditRouteMalformed({ message: String(error) })
      )
    );
    const key = yield* xenditDeliveryKey(envelope, body).pipe(Effect.orDie);
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(refs.internal.billing.events.record, {
      rail: "xendit",
      key,
      type: envelope.event,
      providerTime: DateTime.toEpochMillis(envelope.created),
      payload: body,
    }).pipe(Effect.orDie);
    return HttpServerResponse.text("Accepted", { status: HTTP_ACCEPTED });
  }).pipe(
    Effect.catchTags({
      XenditTokenRejected: () =>
        Effect.logWarning(
          "Xendit webhook refused: the callback token does not match."
        ).pipe(
          Effect.as(
            HttpServerResponse.text("Forbidden", { status: HTTP_FORBIDDEN })
          )
        ),
      XenditRouteMalformed: (error) =>
        Effect.logWarning("Xendit webhook refused: the request is malformed.", {
          message: error.message,
        }).pipe(
          Effect.as(
            HttpServerResponse.text("Bad Request", { status: HTTP_BAD_REQUEST })
          )
        ),
    }),
    Effect.catchCause((cause) =>
      Effect.logError("Xendit webhook processing failed", cause).pipe(
        Effect.as(
          HttpServerResponse.text("Internal server error", {
            status: HTTP_INTERNAL_ERROR,
          })
        )
      )
    )
  )
);
