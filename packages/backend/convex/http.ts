import "@repo/backend/convex/polyfills";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth/runtime";
import {
  isForumAttachmentUploadPath,
  registerForumAttachmentUploadRoute,
} from "@repo/backend/convex/classes/forums/attachments/route";
import { registerPublicContentRuntimeBatchRoute } from "@repo/backend/convex/contentRelease/http/runtime/batch";
import { registerRetainedProtectedContentRuntimeRoute } from "@repo/backend/convex/contentRelease/http/runtime/history";
import { registerProtectedContentRuntimeRoute } from "@repo/backend/convex/contentRelease/http/runtime/protected";
import { registerPublicContentRuntimeRoute } from "@repo/backend/convex/contentRelease/http/runtime/public";
import { registerContentReleaseRoutes } from "@repo/backend/convex/contentRelease/ingress/route";
import { registerAgentApiRoutes } from "@repo/backend/convex/routes/agent/api";
import { registerAgentMcpRoutes } from "@repo/backend/convex/routes/agent/mcp";
import { requestId } from "@repo/backend/convex/routes/middleware/requestId";
import { registerPolarRoutes } from "@repo/backend/convex/routes/polar";
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
const requestLogger = logger((...args) => {
  console.info(...args.map(stripAnsi));
});

app.use("*", (c, next) =>
  isForumAttachmentUploadPath(c.req.path) ? next() : requestLogger(c, next)
);

// Domain-owned routes define CORS and origin authentication at their boundary.

// OpenID Connect discovery - redirect to Better Auth endpoint
app.get("/.well-known/openid-configuration", (c) =>
  c.redirect("/api/auth/convex/.well-known/openid-configuration")
);

// Register better-auth routes (internal - not exposed in API docs)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Register the public read API and its machine-readable contract.
registerAgentApiRoutes(app);
registerAgentMcpRoutes(app);

// Register webhook routes (internal - called by external services)
registerPolarRoutes(app);

// Register capability-authenticated forum attachment uploads.
registerForumAttachmentUploadRoute(app);

// Register authenticated content publication routes.
registerContentReleaseRoutes(app);

// Register server-authenticated executable content reads.
registerPublicContentRuntimeBatchRoute(app);
registerPublicContentRuntimeRoute(app);
registerProtectedContentRuntimeRoute(app);
registerRetainedProtectedContentRuntimeRoute(app);

export default new HttpRouterWithHono(app);
