import { HttpRouter, HttpServerResponse } from "effect/http";

// Register discovery explicitly: the SDK sees Confect's catch-all as an existing route.
export const authDiscoveryRoutes = HttpRouter.add(
  "GET",
  "/.well-known/openid-configuration",
  HttpServerResponse.redirect(
    "/api/auth/convex/.well-known/openid-configuration"
  )
);
