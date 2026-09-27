import { resend } from "@repo/backend/confect/emails/client";
import type { HttpRouter } from "convex/server";
import { httpActionGeneric } from "convex/server";

export const RESEND_WEBHOOK_PATH = "/resend/events";

/** The component SDK owns signature validation, registration and event state. */
export function registerResendRoutes(http: HttpRouter) {
  http.route({
    path: RESEND_WEBHOOK_PATH,
    method: "POST",
    handler: httpActionGeneric((ctx, request) =>
      resend.handleResendEventWebhook(ctx, request)
    ),
  });
}
