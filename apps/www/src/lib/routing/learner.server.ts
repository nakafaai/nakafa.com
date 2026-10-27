import { env } from "cloudflare:workers";
import { Effect, Option } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { namesLearnerPage, staticPagePath } from "@/lib/routing/prerendered";
import { hasStaticRelease } from "@/lib/routing/release";
import { routeRewrite } from "@/lib/routing/rewrite";

/** The status of the assets' answer to a path that names no asset. */
const NOT_FOUND = 404;

/**
 * Whether a learner sends a request: it carries a session cookie, which only the
 * server can see, or its address is bound to one attempt.
 */
function isLearnerRequest(request: Request) {
  return (
    readSessionCookie(request) !== null ||
    hasTryoutAttemptCapability(new URL(request.url).searchParams)
  );
}

/**
 * Whether a request names a try-out track, set or section of the main site. The
 * router matches the path that its input rewrite gives, so a school host's path,
 * which becomes its School tree path, names none.
 */
function namesTryoutPage(request: Request) {
  const { pathname } = routeRewrite.input({ url: new URL(request.url) });
  return namesLearnerPage(pathname);
}

/**
 * Whether the Worker renders a request as a learner's own try-out page: a track,
 * a set or a section that a learner asks for. The build prerenders these pages for
 * a visitor, so the Worker renders no other request for them.
 */
export function isLearnerPage(request: Request): boolean {
  return namesTryoutPage(request) && isLearnerRequest(request);
}

/**
 * A visitor's read of a try-out track, set or section, answered with the page that
 * the build wrote for every visitor (`staticPagePath`), so the Worker renders
 * nothing for it. A page that the release does not hold answers nothing here, so
 * the Worker's decisions answer it as any other miss, with the static not-found
 * page last. A prerender and a development server bind no assets.
 */
export const readVisitorAsset = Effect.fn("www.routing.learner.asset")(
  function* (request: Request) {
    if (
      !hasStaticRelease() ||
      (request.method !== "GET" && request.method !== "HEAD") ||
      !namesTryoutPage(request) ||
      isLearnerRequest(request)
    ) {
      return Option.none<Response>();
    }
    const url = new URL(request.url);
    const page = yield* Effect.promise(() =>
      env.ASSETS.fetch(
        new Request(new URL(staticPagePath(url.pathname), url), request)
      )
    );
    if (page.status !== NOT_FOUND) {
      return Option.some(page);
    }
    yield* Effect.promise(async () => {
      await page.body?.cancel();
    });
    return Option.none<Response>();
  }
);
