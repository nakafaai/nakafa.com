import type { ConvexActionCtx } from "@repo/backend/confect/modules/shared/convexContext";
import type { MiddlewareHandler } from "hono";

const REQUEST_ID_HEADER = "X-Request-ID";

/** Adds a stable request id to each HTTP route context. */
export const requestId: MiddlewareHandler<{
  Bindings: ConvexActionCtx;
  Variables: {
    requestId: string;
  };
}> = async (context, next) => {
  context.set(
    "requestId",
    context.req.header(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  );
  await next();
};
