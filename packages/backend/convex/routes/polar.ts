import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { internal } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { convertToDatabaseCustomer } from "@repo/backend/convex/customers/utils";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/convex/routes/constants";
import { convertToDatabaseSubscription } from "@repo/backend/convex/subscriptions/utils";
import { logger } from "@repo/backend/convex/utils/logger";
import { polarWebhookSecret } from "@repo/backend/convex/utils/polar";
import type { HonoWithConvex } from "convex-helpers/server/hono";

/**
 * Upsert the local customer row only when the webhook can be matched back to a
 * known app user.
 */
async function handleCustomerUpsert(
  ctx: ActionCtx,
  customer: {
    id: string;
    externalId?: string | null;
    email: string;
    metadata: Record<string, string | number | boolean>;
  }
) {
  const userId = await ctx.runQuery(
    internal.customers.queries.getUserIdByPolarCustomer,
    {
      externalId: customer.externalId ?? undefined,
      metadataUserId:
        typeof customer.metadata.userId === "string"
          ? customer.metadata.userId
          : undefined,
    }
  );

  if (!userId) {
    return false;
  }

  await ctx.runMutation(internal.customers.mutations.upsertCustomer, {
    customer: convertToDatabaseCustomer({
      id: customer.id,
      externalId: customer.externalId,
      metadata: customer.metadata,
      userId,
    }),
  });

  return true;
}

/**
 * Verify one Polar webhook payload, then dispatch the matching customer or
 * subscription mutation.
 */
async function handlePolarEvent(
  ctx: ActionCtx,
  body: string,
  headers: Headers
) {
  const event = validateEvent(
    body,
    Object.fromEntries(headers.entries()),
    polarWebhookSecret
  );

  switch (event.type) {
    case "customer.created":
    case "customer.updated": {
      return await handleCustomerUpsert(ctx, event.data);
    }
    case "customer.deleted": {
      await ctx.runMutation(internal.customers.mutations.deleteCustomerById, {
        id: event.data.id,
      });
      return true;
    }
    case "subscription.created": {
      await ctx.runMutation(
        internal.subscriptions.mutations.createSubscription,
        {
          subscription: convertToDatabaseSubscription(event.data),
        }
      );
      return true;
    }
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.uncanceled":
    case "subscription.revoked": {
      await ctx.runMutation(
        internal.subscriptions.mutations.updateSubscription,
        {
          subscription: convertToDatabaseSubscription(event.data),
        }
      );
      return true;
    }
    default: {
      return true;
    }
  }
}

/** Register Polar webhook routes on the Hono app. */
export function registerPolarRoutes(app: HonoWithConvex<ActionCtx>) {
  app.post("/polar/events", async (c) => {
    const body = await c.req.text();

    try {
      const handled = await handlePolarEvent(c.env, body, c.req.raw.headers);

      if (!handled) {
        return c.text("Bad Request: Missing User", HTTP_BAD_REQUEST);
      }

      return c.text("Accepted", HTTP_ACCEPTED);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        logger.warn("Polar webhook verification failed", {
          error: error.message,
        });
        return c.text("Forbidden", HTTP_FORBIDDEN);
      }

      logger.error("Polar webhook processing failed", undefined, error);
      return c.text("Internal server error", HTTP_INTERNAL_ERROR);
    }
  });
}
