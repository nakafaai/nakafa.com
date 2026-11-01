import {
  HttpRouter as ConfectHttpRouter,
  ConvexConfigProvider,
} from "@confect/server";
import { isActionCtx } from "@convex-dev/better-auth/utils";
import { authComponent } from "@repo/backend/confect/auth/client";
import { agentGrants } from "@repo/backend/confect/auth/grant";
import { guardianCodeSignIn } from "@repo/backend/confect/auth/guardian";
import { schoolUsernameSignIn } from "@repo/backend/confect/auth/login";
import { authDiscoveryRoutes } from "@repo/backend/confect/auth/route";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { requestContext } from "@repo/backend/confect/routes/middleware/context";
import { Effect, Layer } from "effect";

const http = ConfectHttpRouter.make(
  authDiscoveryRoutes.pipe(Layer.provide(requestContext.layer))
);

// SDK-owned routes use Confect's documented plain component boundary. The router alone
// adds the school username and guardian code sign-ins, because only a request names the
// school host of them.
authComponent.registerRoutesLazy(http, (ctx) =>
  Effect.runSync(
    createAuth(
      ctx,
      isActionCtx(ctx)
        ? [schoolUsernameSignIn(ctx), guardianCodeSignIn(ctx), agentGrants(ctx)]
        : []
    ).pipe(Effect.provide(ConvexConfigProvider.layer))
  )
);

export default http;
