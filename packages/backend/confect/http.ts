import { HttpApi } from "@confect/server";
import { PolarApiLive } from "@repo/backend/confect/modules/commerce/polar/webhook.http";
import { createAuth } from "@repo/backend/confect/modules/identity/auth/runtime.service";
import {
  HTTP_FOUND,
  HTTP_OK,
} from "@repo/backend/confect/modules/operations/http.constants";
import {
  V1ApiLive,
  v1Metadata,
} from "@repo/backend/confect/modules/operations/v1.api";
import { httpAction } from "@repo/backend/convex/_generated/server";

const OPENID_CONFIGURATION_PATH =
  "/api/auth/convex/.well-known/openid-configuration";

/** Redirects Convex auth discovery to the Better Auth OpenID configuration route. */
const openIdConfigurationRedirect = httpAction(() =>
  Promise.resolve(
    new Response(null, {
      headers: { Location: OPENID_CONFIGURATION_PATH },
      status: HTTP_FOUND,
    })
  )
);

/** Delegates Better Auth HTTP requests at the documented native Convex boundary. */
const authHandler = httpAction((ctx, request) => {
  const auth = createAuth(ctx);
  return auth.handler(request);
});

/**
 * Preserves the exact `/v1` route because Convex path prefixes only match
 * slash-suffixed paths.
 */
const v1Root = httpAction(() =>
  Promise.resolve(
    new Response(JSON.stringify(v1Metadata), {
      headers: { "Content-Type": "application/json" },
      status: HTTP_OK,
    })
  )
);

/**
 * Root HTTP router source generated into `convex/http.ts` by Confect.
 *
 * References:
 * - https://confect.dev/concepts/project-structure#rules
 * - https://confect.dev/server/http-api
 * - https://confect.dev/server/plain-convex-functions
 */
const http = HttpApi.make({
  "/polar/": { apiLive: PolarApiLive },
  "/v1/": { apiLive: V1ApiLive },
});

http.route({
  handler: openIdConfigurationRedirect,
  method: "GET",
  path: "/.well-known/openid-configuration",
});

http.route({
  handler: authHandler,
  method: "GET",
  pathPrefix: "/api/auth/",
});

http.route({
  handler: authHandler,
  method: "POST",
  pathPrefix: "/api/auth/",
});

http.route({
  handler: v1Root,
  method: "GET",
  path: "/v1",
});

export default http;
