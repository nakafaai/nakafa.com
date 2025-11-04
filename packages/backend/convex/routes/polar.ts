import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  convertToDatabaseCustomer,
  findUserIdFromCustomer,
} from "../customers/utils";
import { convertToDatabaseSubscription } from "../subscriptions/utils";
import { polarWebhookSecret } from "../utils/polar";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "./constants";

/**
 * Register Polar webhook routes on the Hono app.
 */
export function registerPolarRoutes(app: HonoWithConvex<ActionCtx>) {
  app.post("/polar/events", async (c) => {
    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());

    try {
      const event = validateEvent(body, headers, polarWebhookSecret);

      switch (event.type) {
        case "customer.created": {
          const userId = await findUserIdFromCustomer(c.env, event.data);

          if (!userId) {
            return c.text("Bad Request: Missing User", HTTP_BAD_REQUEST);
          }

          await c.env.runMutation(internal.customers.mutations.insertCustomer, {
            customer: convertToDatabaseCustomer({
              ...event.data,
              userId,
            }),
          });
          break;
        }

        case "customer.updated": {
          const userId = await findUserIdFromCustomer(c.env, event.data);

          if (!userId) {
            return c.text("Bad Request: Missing User", HTTP_BAD_REQUEST);
          }

          await c.env.runMutation(internal.customers.mutations.updateCustomer, {
            customer: convertToDatabaseCustomer({
              ...event.data,
              userId,
            }),
          });
          break;
        }

        case "customer.deleted": {
          await c.env.runMutation(
            internal.customers.mutations.deleteCustomerById,
            {
              id: event.data.id,
            }
          );
          break;
        }

        case "subscription.created": {
          await c.env.runMutation(
            internal.subscriptions.mutations.createSubscription,
            {
              subscription: convertToDatabaseSubscription(event.data),
            }
          );
          break;
        }

        case "subscription.updated": {
          await c.env.runMutation(
            internal.subscriptions.mutations.updateSubscription,
            {
              subscription: convertToDatabaseSubscription(event.data),
            }
          );
          break;
        }

        default:
          break;
      }

      return c.text("Accepted", HTTP_ACCEPTED);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return c.text(`Forbidden: ${error}`, HTTP_FORBIDDEN);
      }
      return c.text(`Internal server error: ${error}`, HTTP_INTERNAL_ERROR);
    }
  });
}
