import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import refs from "@repo/backend/confect/_generated/refs";
import { readPolarWebhookSecret } from "@repo/backend/confect/modules/commerce/polar/webhook.env";
import { convertToDatabaseSubscription } from "@repo/backend/confect/modules/commerce/subscriptions.mapper";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/confect/modules/operations/http.constants";
import type { ConvexActionCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Schema } from "effect";

export class PolarWebhookProcessingError extends Schema.TaggedError<PolarWebhookProcessingError>()(
  "PolarWebhookProcessingError",
  { message: Schema.String }
) {}

export class PolarWebhookVerificationFailed extends Schema.TaggedError<PolarWebhookVerificationFailed>()(
  "PolarWebhookVerificationFailed",
  { message: Schema.String }
) {}

interface PolarCustomerPayload {
  readonly externalId?: string | null;
  readonly id: string;
  readonly metadata?: Record<string, string | number | boolean> | null;
}

/** Verifies a raw Polar webhook request and returns the typed event payload. */
const verifyPolarEvent = Effect.fn("polar.verifyWebhook")(function* (
  body: string,
  headers: Headers
) {
  const secret = yield* readPolarWebhookSecret();

  return yield* Effect.try({
    try: () =>
      validateEvent(body, Object.fromEntries(headers.entries()), secret),
    catch: (error) => {
      if (error instanceof WebhookVerificationError) {
        return new PolarWebhookVerificationFailed({ message: error.message });
      }

      return new PolarWebhookProcessingError({
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });
});

/** Upserts a local customer row when the webhook can be mapped to an app user. */
const handleCustomerUpsert = Effect.fn("polar.handleCustomerUpsert")(function* (
  ctx: ConvexActionCtx,
  customer: PolarCustomerPayload
) {
  const metadataUserId =
    typeof customer.metadata?.userId === "string"
      ? customer.metadata.userId
      : undefined;
  const userId = yield* Effect.promise(() =>
    ctx.runQuery(
      toConvexReference(
        refs.internal.customers.queries.internalFunctions.customer
          .getUserIdByPolarCustomer
      ),
      {
        externalId: customer.externalId ?? undefined,
        metadataUserId,
      }
    )
  );

  if (!userId) {
    return false;
  }

  yield* Effect.promise(() =>
    ctx.runMutation(
      toConvexReference(
        refs.internal.customers.mutations.internalFunctions.upsertCustomer
      ),
      {
        customer: {
          externalId: customer.externalId ?? null,
          id: customer.id,
          metadata: customer.metadata ?? {},
          userId,
        },
      }
    )
  );

  return true;
});

/** Dispatches a verified Polar webhook to the matching Confect mutation. */
const handlePolarEvent = Effect.fn("polar.handleWebhook")(function* (
  ctx: ConvexActionCtx,
  body: string,
  headers: Headers
) {
  const event = yield* verifyPolarEvent(body, headers);

  switch (event.type) {
    case "customer.created":
    case "customer.updated":
      return yield* handleCustomerUpsert(ctx, event.data);
    case "customer.deleted":
      yield* Effect.promise(() =>
        ctx.runMutation(
          toConvexReference(
            refs.internal.customers.mutations.internalFunctions
              .deleteCustomerById
          ),
          { id: event.data.id }
        )
      );
      return true;
    case "subscription.created":
      yield* Effect.promise(() =>
        ctx.runMutation(
          toConvexReference(
            refs.internal.subscriptions.mutations.createSubscription
          ),
          {
            subscription: convertToDatabaseSubscription(event.data),
          }
        )
      );
      return true;
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.revoked":
    case "subscription.uncanceled":
    case "subscription.updated":
      yield* Effect.promise(() =>
        ctx.runMutation(
          toConvexReference(
            refs.internal.subscriptions.mutations.updateSubscription
          ),
          {
            subscription: convertToDatabaseSubscription(event.data),
          }
        )
      );
      return true;
    default:
      return true;
  }
});

/** Registers Polar webhook routes on the native Convex HTTP adapter. */
export function registerPolarRoutes(
  app: HonoWithConvex<ConvexActionCtx, { requestId: string }>
) {
  app.post("/polar/events", async (context) => {
    const body = await context.req.text();
    const result = await Effect.runPromise(
      Effect.either(
        handlePolarEvent(context.env, body, context.req.raw.headers)
      )
    );

    if (result._tag === "Right") {
      if (!result.right) {
        return context.text("Bad Request: Missing User", HTTP_BAD_REQUEST);
      }

      return context.text("Accepted", HTTP_ACCEPTED);
    }

    if (result.left._tag === "PolarWebhookVerificationFailed") {
      await Effect.runPromise(
        Effect.logWarning("Polar webhook verification failed", {
          error: result.left.message,
        })
      );
      return context.text("Forbidden", HTTP_FORBIDDEN);
    }

    await Effect.runPromise(
      Effect.logError("Polar webhook processing failed", {
        error: result.left.message,
      })
    );
    return context.text("Internal server error", HTTP_INTERNAL_ERROR);
  });
}
