import "@repo/backend/convex/polyfills";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth/runtime";
import {
  isForumAttachmentUploadPath,
  registerForumAttachmentUploadRoute,
} from "@repo/backend/convex/classes/forums/attachments/route";
import { registerPublicContentRuntimeBatchRoute } from "@repo/backend/convex/contentRelease/http/runtime/batch";
import { registerProtectedContentRuntimeRoute } from "@repo/backend/convex/contentRelease/http/runtime/protected";
import { registerPublicContentRuntimeRoute } from "@repo/backend/convex/contentRelease/http/runtime/public";
import { registerContentReleaseRoutes } from "@repo/backend/convex/contentRelease/ingress/route";
import { registerAgentApiRoutes } from "@repo/backend/convex/routes/agent/api";
import { registerAgentMcpRoutes } from "@repo/backend/convex/routes/agent/mcp/route";
import { requestId } from "@repo/backend/convex/routes/middleware/requestId";
import { createQueryFreeRequestLogger } from "@repo/backend/convex/routes/middleware/requestLogger";
import { registerPolarRoutes } from "@repo/backend/convex/routes/polar";
import { registerResendRoutes } from "@repo/backend/convex/routes/resend";
import {
  type HonoWithConvex,
  HttpRouterWithHono,
} from "convex-helpers/server/hono";
import { Hono } from "hono";

const app: HonoWithConvex<ActionCtx, { requestId: string }> = new Hono();

// Request ID middleware - must be first for distributed tracing
app.use("*", requestId);

// Request queries may contain OAuth diagnostics or other private credentials.
const requestLogger = createQueryFreeRequestLogger((message) => {
  console.info(message);
});

app.use("*", (c, next) =>
  isForumAttachmentUploadPath(c.req.path) ? next() : requestLogger(c, next)
);

// Every domain route owns its CORS and origin-authentication boundary.

// OpenID Connect discovery - redirect to Better Auth endpoint
app.get("/.well-known/openid-configuration", (c) =>
  c.redirect("/api/auth/convex/.well-known/openid-configuration")
);

// Register better-auth routes (internal - not exposed in API docs)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Register the protected public protocols and their machine-readable contract.
registerAgentApiRoutes(app);
registerAgentMcpRoutes(app);

// Register webhook routes (internal - called by external services)
registerPolarRoutes(app);
registerResendRoutes(app);

// Register capability-authenticated forum attachment uploads.
registerForumAttachmentUploadRoute(app);

// Register authenticated content publication routes.
registerContentReleaseRoutes(app);

// Register server-authenticated executable content reads.
registerPublicContentRuntimeBatchRoute(app);
registerPublicContentRuntimeRoute(app);
registerProtectedContentRuntimeRoute(app);

export default new HttpRouterWithHono(app);
