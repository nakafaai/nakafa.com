import "./polyfills";
import {
  type HonoWithConvex,
  HttpRouterWithHono,
} from "convex-helpers/server/hono";
import { Hono } from "hono";
import { logger } from "hono/logger";
import stripAnsi from "strip-ansi";
import type { ActionCtx } from "./_generated/server";
import { createAuth } from "./auth";
import { registerPolarRoutes } from "./routes/polar";
import v1 from "./routes/v1";

const app: HonoWithConvex<ActionCtx> = new Hono();

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
