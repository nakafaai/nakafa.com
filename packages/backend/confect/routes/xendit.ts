import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import {
  sameCallbackToken,
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

/** The callback token of the request is not the deployment's token, so the request is not Xendit's. */
class XenditRouteForbidden extends Schema.TaggedError<XenditRouteForbidden>()(
  "XenditRouteForbidden",
  {}
) {}

/** The body is not a Xendit webhook envelope. */
class XenditRouteMalformed extends Schema.TaggedError<XenditRouteMalformed>()(
  "XenditRouteMalformed",
  {
    message: Schema.String,
  }
) {}

/**
 * Receives one Xendit webhook. The route checks the callback token, stores the
 * delivery in the inbox once, and answers 2xx, so Xendit stops retrying. A
 * redelivery of a stored delivery changes nothing.
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
      "XENDIT_WEBHOOK_TOKEN"
    );
    const received = request.headers.get("x-callback-token") ?? "";
    if (!sameCallbackToken(received, Redacted.value(expected))) {
      return yield* new XenditRouteForbidden({});
    }
    const body = yield* Effect.promise(() => request.text());
    const envelope = yield* Schema.decodeEffect(
      Schema.fromJsonString(XenditWebhookEnvelope)
    )(body).pipe(
      Effect.mapError(
        (error) => new XenditRouteMalformed({ message: String(error) })
      )
    );
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(refs.internal.billing.events.record, {
      rail: "xendit",
      key: xenditDeliveryKey(envelope),
      type: envelope.event,
      providerTime: DateTime.toEpochMillis(
        DateTime.makeUnsafe(envelope.created)
      ),
      payload: body,
    }).pipe(Effect.orDie);
    return HttpServerResponse.text("Accepted", { status: HTTP_ACCEPTED });
  }).pipe(
    Effect.catchTags({
      XenditRouteForbidden: () =>
        Effect.succeed(
          HttpServerResponse.text("Forbidden", { status: HTTP_FORBIDDEN })
        ),
      XenditRouteMalformed: () =>
        Effect.succeed(
          HttpServerResponse.text("Bad Request", { status: HTTP_BAD_REQUEST })
        ),
    }),
    Effect.catchCause(() =>
      Effect.succeed(
        HttpServerResponse.text("Internal server error", {
          status: HTTP_INTERNAL_ERROR,
        })
      )
    )
  )
);
