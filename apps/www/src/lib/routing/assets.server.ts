import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { routeRewrite } from "@/lib/routing/rewrite";
import { answerRouted, type RouterHandler } from "@/lib/routing/routed.server";
import { isSignInPath } from "@/lib/routing/signin";
import { answerUnmatchedRequest } from "@/lib/routing/unmatched.server";

/**
 * Answers a path that no Worker route renders, from the static assets. The
 * sign-in page is the one such page that reaches the Worker first
 * (`runWorkerFirst`): a visitor gets its prerendered page, with no render, and a
 * request with a session cookie goes to the router, whose gate moves a signed-in
 * learner on with 307 and renders the page for a session that has ended. Every
 * other such path answers the static not-found page.
 */
export const answerStaticPath = Effect.fn("www.routing.staticPath")(function* (
  request: Request,
  route: RouterHandler
) {
  const { pathname } = routeRewrite.input({ url: new URL(request.url) });
  if (!isSignInPath(pathname)) {
    return yield* answerUnmatchedRequest(request);
  }
  if (readSessionCookie(request) !== null) {
    return yield* answerRouted(request, route);
  }
  return yield* Effect.promise(() => env.ASSETS.fetch(request));
});
