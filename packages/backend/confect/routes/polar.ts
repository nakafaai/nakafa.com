import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import {
  WebhookVerificationError as PolarSdkVerificationError,
  validateEvent,
} from "@polar-sh/sdk/webhooks";
import { processPolarWebhookEvent } from "@repo/backend/confect/customers/polar/webhook";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/confect/routes/constants";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Config, Effect, Redacted, Schema } from "effect";

type PolarWebhookEvent = ReturnType<typeof validateEvent>;
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
class PolarWebhookPayloadError extends Schema.TaggedError<PolarWebhookPayloadError>()(
  "PolarWebhookPayloadError",
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

/** Verifies the signature and decodes the SDK payload without throwing. */
const verifyPolarWebhook = Effect.fn("routes.polar.verify")(function* (
  body: string,
  headers: Record<string, string>
) {
  const secret = yield* Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    "POLAR_WEBHOOK_SECRET"
  ).pipe(
    Effect.mapError(
      () =>
        new PolarWebhookSdkError({
          message: "Polar webhook configuration is unavailable.",
        })
    )
  );
  return yield* Effect.try({
    catch: (error) => {
      const message = getUnknownErrorMessage(error);
      if (error instanceof PolarSdkVerificationError) {
        return new PolarWebhookVerificationError({
          message,
        });
      }
      if (error instanceof SDKValidationError) {
        return new PolarWebhookPayloadError({
          message,
        });
      }
      return new PolarWebhookSdkError({
        message,
      });
    },
    try: (): PolarWebhookEvent =>
      validateEvent(body, headers, Redacted.value(secret)),
  });
});

/** Register Polar webhook routes on the Hono app. */
export function registerPolarRoutes<Variables extends Record<string, unknown>>(
  app: HonoWithConvex<ActionCtx, Variables>
) {
  app.post("/polar/events", (c) => {
    const program = Effect.gen(function* () {
      const body = yield* readPolarWebhookBody(c.req.raw);
      const event = yield* verifyPolarWebhook(
        body,
        Object.fromEntries(c.req.raw.headers.entries())
      );
      const handled = yield* processPolarWebhookEvent(c.env, event);
      if (!handled) {
        return c.text("Bad Request: Missing User", HTTP_BAD_REQUEST);
      }
      return c.text("Accepted", HTTP_ACCEPTED);
    }).pipe(
      Effect.catchTags({
        PolarWebhookPayloadError: (error) =>
          Effect.logWarning("Polar webhook payload rejected").pipe(
            Effect.annotateLogs({ error: error.message }),
            Effect.as(c.text("Bad Request", HTTP_BAD_REQUEST))
          ),
        PolarWebhookReadError: (error) =>
          Effect.logError("Polar webhook body read failed", error).pipe(
            Effect.as(c.text("Internal server error", HTTP_INTERNAL_ERROR))
          ),
        PolarWebhookSdkError: (error) =>
          Effect.logError("Polar webhook SDK failed", error).pipe(
            Effect.as(c.text("Internal server error", HTTP_INTERNAL_ERROR))
          ),
        PolarWebhookVerificationError: (error) =>
          Effect.logWarning("Polar webhook verification failed").pipe(
            Effect.annotateLogs({ error: error.message }),
            Effect.as(c.text("Forbidden", HTTP_FORBIDDEN))
          ),
      }),
      Effect.catchCause((cause) =>
        Effect.logError("Polar webhook processing failed", cause).pipe(
          Effect.as(c.text("Internal server error", HTTP_INTERNAL_ERROR))
        )
      )
    );
    return Effect.runPromise(
      program.pipe(Effect.provide(ConvexConfigProvider.layer))
    );
  });
}

import { ConvexConfigProvider } from "@confect/server";
