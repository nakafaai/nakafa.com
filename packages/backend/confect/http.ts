import {
  HttpRouter as ConfectHttpRouter,
  ConvexConfigProvider,
} from "@confect/server";
import { authComponent } from "@repo/backend/confect/auth/client";
import { authDiscoveryRoutes } from "@repo/backend/confect/auth/route";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { attachmentRoutes } from "@repo/backend/confect/classes/forums/attachments/route";
import { batchRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/batch";
import { protectedRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/protected";
import { publicRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/public";
import { publicationRoutes } from "@repo/backend/confect/contentRelease/ingress/route";
import { agentApiRoutes } from "@repo/backend/confect/routes/agent/api";
import { agentMcpRoutes } from "@repo/backend/confect/routes/agent/mcp/route";
import { requestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { requestLogger } from "@repo/backend/confect/routes/middleware/logger";
import { polarRoutes } from "@repo/backend/confect/routes/polar";
import { registerResendRoutes } from "@repo/backend/confect/routes/resend";
import { Effect, Layer } from "effect";

const http = ConfectHttpRouter.make(
  Layer.mergeAll(
    authDiscoveryRoutes,
    agentApiRoutes,
    agentMcpRoutes,
    polarRoutes,
    attachmentRoutes,
    publicationRoutes,
    batchRuntimeRoutes,
    publicRuntimeRoutes,
    protectedRuntimeRoutes
  ).pipe(
    Layer.provide(requestIdentity.layer),
    Layer.provide(requestLogger.layer)
  )
);

// SDK-owned routes use Confect's documented plain component boundary.
authComponent.registerRoutesLazy(http, (ctx) =>
  Effect.runSync(
    createAuth(ctx).pipe(Effect.provide(ConvexConfigProvider.layer))
  )
);
registerResendRoutes(http);
export default http;
