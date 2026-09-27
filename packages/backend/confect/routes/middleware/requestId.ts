import { generateId } from "@repo/backend/confect/utils/id";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { MiddlewareHandler } from "hono";

/**
 * Middleware to ensure every request has a unique correlation ID.
 *
 * Checks for `X-Request-ID` header from client/proxy.
 * If missing, generates a new UUID.
 * Adds `requestId` to context for logging and downstream use.
 */
export const requestId: MiddlewareHandler<{
  Bindings: ActionCtx;
  Variables: {
    requestId: string;
  };
}> = async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? generateId();
  c.set("requestId", requestId);
  await next();
};
