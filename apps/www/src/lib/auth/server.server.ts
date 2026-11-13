import {
  type ExposedSignInFn,
  type RefreshSessionFn,
  type RequestHandler,
  type SignOutFn,
  setupConvexAuthServer,
} from "@convex-dev/auth/ssr";
import { siteUrlKeys } from "@repo/site/keys";
import { makeFunctionReference } from "convex/server";
import { Array as Arr, Effect } from "effect";
import {
  inboundCookieHeader,
  outboundSetCookie,
  siteAuthCookies,
} from "@/lib/auth/cookies";
import { withSessionHint } from "@/lib/auth/hint.server";
import { CONVEX_URL } from "@/lib/server/runtime";

/** Convex Auth's session functions, which the refresh and sign-out routes call. */
const refreshSession: RefreshSessionFn = makeFunctionReference(
  "auth/core:refreshSession"
);
const signOut: SignOutFn = makeFunctionReference("auth/core:signOut");

/**
 * Every function that makes a session from a browser: Google's completion and
 * the school login (ADR 0009). The sign-in route forwards these and refuses
 * every other function.
 */
const signIns: ExposedSignInFn[] = [
  makeFunctionReference("auth/core:completeSignInWithGoogle"),
  makeFunctionReference("auth/school:signIn"),
];

/**
 * One of Convex Auth's handlers on a site whose auth cookies carry a prefix
 * (`siteAuthCookies`): the request reaches it with the site's own cookies under
 * Convex Auth's names, and every auth cookie it sets goes back with the prefix.
 */
const withPrefix =
  (prefix: string, handler: RequestHandler): RequestHandler =>
  async (request) => {
    const headers = new Headers(request.headers);
    headers.set("cookie", inboundCookieHeader(headers.get("cookie") ?? "", prefix));
    const response = await handler(new Request(request, { headers }));
    const renamed = new Headers(response.headers);
    renamed.delete("set-cookie");
    Arr.forEach(response.headers.getSetCookie(), (value) =>
      renamed.append("set-cookie", outboundSetCookie(value, prefix))
    );
    return new Response(response.body, {
      headers: renamed,
      status: response.status,
      statusText: response.statusText,
    });
  };

/**
 * Convex Auth's sign-in, refresh and sign-out routes of this site, which keep
 * the refresh token in an httpOnly cookie and hand the browser only the access
 * token. The cookies cover the whole production domain, so every school host
 * shares the session (ADR 0026), and each answer that starts or ends a session
 * sets the signed-in hint to match.
 * https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup
 */
export const readAuthRoutes = Effect.fn("www.auth.routes")(function* () {
  const convexUrl = yield* CONVEX_URL;
  const site = new URL(siteUrlKeys().SITE_URL);
  const { options, prefix } = siteAuthCookies(site);
  const routes = setupConvexAuthServer({
    convexUrl,
    cookieOptions: options,
    refreshSession,
    signIn: signIns,
    signOut,
  });
  const serve =
    (handler: RequestHandler): RequestHandler =>
    async (request) =>
      withSessionHint(
        await (prefix === "" ? handler : withPrefix(prefix, handler))(request),
        site,
        prefix
      );
  return {
    convexProxyHandler: serve(routes.convexProxyHandler),
    refreshHandler: serve(routes.refreshHandler),
    signOutHandler: serve(routes.signOutHandler),
  };
});
