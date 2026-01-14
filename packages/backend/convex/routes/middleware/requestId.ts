import type { MiddlewareHandler } from "hono";
import type { ActionCtx } from "../../_generated/server";
import { generateId } from "../../utils/helper";
import { REQUEST_ID_HEADER } from "../../utils/logger";

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
  const requestId = c.req.header(REQUEST_ID_HEADER) ?? generateId();
  c.set("requestId", requestId);
  await next();
};
