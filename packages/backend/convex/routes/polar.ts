import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import {
  WebhookVerificationError as PolarSdkVerificationError,
  validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { processPolarWebhookEvent } from "@repo/backend/convex/customers/polar/webhook";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/convex/routes/constants";
import { logger } from "@repo/backend/convex/utils/logger";
import { polarWebhookSecret } from "@repo/backend/convex/utils/polar/webhook";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Cause, Effect, Schema } from "effect";

type PolarWebhookEvent = ReturnType<typeof validateEvent>;

class PolarWebhookReadError extends Schema.TaggedError<PolarWebhookReadError>()(
  "PolarWebhookReadError",
  { message: Schema.String }
) {}

class PolarWebhookVerificationError extends Schema.TaggedError<PolarWebhookVerificationError>()(
  "PolarWebhookVerificationError",
  { message: Schema.String }
) {}

class PolarWebhookPayloadError extends Schema.TaggedError<PolarWebhookPayloadError>()(
  "PolarWebhookPayloadError",
  { message: Schema.String }
) {}

class PolarWebhookSdkError extends Schema.TaggedError<PolarWebhookSdkError>()(
  "PolarWebhookSdkError",
  { message: Schema.String }
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
const verifyPolarWebhook = Effect.fn("routes.polar.verify")(
  (body: string, headers: Record<string, string>) =>
    Effect.try({
      catch: (error) => {
        const message = getUnknownErrorMessage(error);
        if (error instanceof PolarSdkVerificationError) {
          return new PolarWebhookVerificationError({ message });
        }
        if (error instanceof SDKValidationError) {
          return new PolarWebhookPayloadError({ message });
        }
        return new PolarWebhookSdkError({ message });
      },
      try: (): PolarWebhookEvent =>
        validateEvent(body, headers, polarWebhookSecret),
    })
);

/** Register Polar webhook routes on the Hono app. */
export function registerPolarRoutes(app: HonoWithConvex<ActionCtx>) {
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
          Effect.sync(() => {
            logger.warn("Polar webhook payload rejected", {
              error: error.message,
            });
            return c.text("Bad Request", HTTP_BAD_REQUEST);
          }),
        PolarWebhookReadError: (error) =>
          Effect.sync(() => {
            logger.error("Polar webhook body read failed", undefined, error);
            return c.text("Internal server error", HTTP_INTERNAL_ERROR);
          }),
        PolarWebhookSdkError: (error) =>
          Effect.sync(() => {
            logger.error("Polar webhook SDK failed", undefined, error);
            return c.text("Internal server error", HTTP_INTERNAL_ERROR);
          }),
        PolarWebhookVerificationError: (error) =>
          Effect.sync(() => {
            logger.warn("Polar webhook verification failed", {
              error: error.message,
            });
            return c.text("Forbidden", HTTP_FORBIDDEN);
          }),
      }),
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const error = Cause.squash(cause);
          logger.error("Polar webhook processing failed", undefined, error);
          return c.text("Internal server error", HTTP_INTERNAL_ERROR);
        })
      )
    );

    return Effect.runPromise(program);
  });
}
