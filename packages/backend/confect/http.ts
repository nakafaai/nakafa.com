import { registerPolarRoutes } from "@repo/backend/confect/modules/commerce/polar/webhook.routes";
import { createAuth } from "@repo/backend/confect/modules/identity/auth.service";
import { v1Routes } from "@repo/backend/confect/modules/operations/httpV1.routes";
import { requestId } from "@repo/backend/confect/modules/operations/requestId.middleware";
import type { ConvexActionCtx } from "@repo/backend/confect/modules/shared/convexContext";
import {
  type HonoWithConvex,
  HttpRouterWithHono,
} from "convex-helpers/server/hono";
import { Hono } from "hono";

const app: HonoWithConvex<
  ConvexActionCtx,
  {
    requestId: string;
  }
> = new Hono();

app.use("*", requestId);

app.get("/.well-known/openid-configuration", (context) =>
  context.redirect("/api/auth/convex/.well-known/openid-configuration")
);

app.on(["GET", "POST"], "/api/auth/*", (context) => {
  const auth = createAuth(context.env);
  return auth.handler(context.req.raw);
});

app.route("/v1", v1Routes);

registerPolarRoutes(app);

export default new HttpRouterWithHono(app);
