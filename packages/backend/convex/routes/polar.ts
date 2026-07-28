import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { processPolarWebhookEvent } from "@repo/backend/convex/customers/polar/webhook";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/convex/routes/constants";
import { logger } from "@repo/backend/convex/utils/logger";
import { polarWebhookSecret } from "@repo/backend/convex/utils/polar/webhook";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

/** Register Polar webhook routes on the Hono app. */
export function registerPolarRoutes(app: HonoWithConvex<ActionCtx>) {
  app.post("/polar/events", async (c) => {
    const body = await c.req.text();

    try {
      const event = validateEvent(
        body,
        Object.fromEntries(c.req.raw.headers.entries()),
        polarWebhookSecret
      );
      const handled = await Effect.runPromise(
        processPolarWebhookEvent(c.env, event)
      );

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
