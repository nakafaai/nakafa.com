import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { resend } from "@repo/backend/convex/emails/client";
import type { HonoWithConvex } from "convex-helpers/server/hono";

export const RESEND_WEBHOOK_PATH = "/resend/events";

/**
 * Mounts the component-owned, signature-verified Resend event endpoint.
 * The component reads `RESEND_WEBHOOK_SECRET` and owns all provider state.
 */
export function registerResendRoutes<Variables extends Record<string, unknown>>(
  app: HonoWithConvex<ActionCtx, Variables>
) {
  app.post(RESEND_WEBHOOK_PATH, (context) =>
    resend.handleResendEventWebhook(context.env, context.req.raw)
  );
}
