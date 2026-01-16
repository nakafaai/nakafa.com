import "@repo/backend/convex/polyfills";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth";
import { requestId } from "@repo/backend/convex/routes/middleware/requestId";
import { registerPolarRoutes } from "@repo/backend/convex/routes/polar";
import v1 from "@repo/backend/convex/routes/v1";
import {
  type HonoWithConvex,
  HttpRouterWithHono,
} from "convex-helpers/server/hono";
import { Hono } from "hono";
import { logger } from "hono/logger";
import stripAnsi from "strip-ansi";

const app: HonoWithConvex<ActionCtx> = new Hono();

// Request ID middleware - must be first for distributed tracing
app.use("*", requestId);

// Logging middleware - strip ANSI for Convex dashboard
app.use(
  "*",
  logger((...args) => {
    console.info(...args.map(stripAnsi));
  })
);

// Note: CORS is handled in Next.js middleware (apps/api/proxy.ts)
// All requests to Convex come from Next.js (server-to-server)

// OpenID Connect discovery - redirect to Better Auth endpoint
app.get("/.well-known/openid-configuration", (c) =>
  c.redirect("/api/auth/convex/.well-known/openid-configuration")
);

// Register better-auth routes (internal - not exposed in API docs)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Register public API v1 routes
app.route("/v1", v1);

// Register webhook routes (internal - called by external services)
registerPolarRoutes(app);

export default new HttpRouterWithHono(app);
