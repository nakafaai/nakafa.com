import "./polyfills";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { httpActionGeneric, httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import {
  convertToDatabaseCustomer,
  findUserIdFromCustomer,
} from "./customers/utils";
import { convertToDatabaseSubscription } from "./subscriptions/utils";
import { polarWebhookSecret } from "./utils/polar";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/polar/events",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    if (!request.body) {
      return new Response("No body", { status: 400 });
    }
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    try {
      const event = validateEvent(body, headers, polarWebhookSecret);
      switch (event.type) {
        case "customer.created": {
          const userId = await findUserIdFromCustomer(ctx, event.data);

          if (!userId) {
            return new Response("Bad Request: Missing User", {
              status: 400,
            });
          }

          await ctx.runMutation(api.customers.mutation.insertCustomer, {
            customer: convertToDatabaseCustomer({
              ...event.data,
              userId,
            }),
          });
          break;
        }
        case "customer.updated": {
          const userId = await findUserIdFromCustomer(ctx, event.data);

          if (!userId) {
            return new Response("Bad Request: Missing User", {
              status: 400,
            });
          }

          await ctx.runMutation(api.customers.mutation.upsertCustomer, {
            customer: convertToDatabaseCustomer({
              ...event.data,
              userId,
            }),
          });
          break;
        }
        case "customer.deleted": {
          await ctx.runMutation(api.customers.mutation.deleteCustomerById, {
            id: event.data.id,
          });
          break;
        }
        case "subscription.created": {
          await ctx.runMutation(api.subscriptions.mutation.createSubscription, {
            subscription: convertToDatabaseSubscription(event.data),
          });
          break;
        }
        case "subscription.updated": {
          await ctx.runMutation(api.subscriptions.mutation.updateSubscription, {
            subscription: convertToDatabaseSubscription(event.data),
          });
          break;
        }
        default:
          break;
      }
      return new Response("Accepted", { status: 202 });
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return new Response(`Forbidden: ${error}`, { status: 403 });
      }
      return new Response(`Internal server error: ${error}`, { status: 500 });
    }
  }),
});

export default http;
