import { env } from "cloudflare:workers";
import { Array as Arr, Effect, Option } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { LEARNER_ROUTE_TEMPLATES } from "@/lib/routing/prerendered";
import { hasStaticRelease } from "@/lib/routing/release";
import { matchesRouteTemplate, namesFile } from "@/lib/routing/template";

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
 * Whether the Worker renders a request as a learner's own try-out page: a track,
 * a set or a section, not a file beside it such as its `.md` twin, that a learner
 * asks for. The build prerenders these pages for a visitor, so for any other
 * request they are assets.
 */
export function isLearnerPage(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return (
    !namesFile(pathname) &&
    Arr.some(LEARNER_ROUTE_TEMPLATES, (template) =>
      matchesRouteTemplate(template, pathname)
    ) &&
    isLearnerRequest(request)
  );
}

/**
 * Whether a path lies at or beneath a learner page, where the Worker runs before
 * the static assets, so a learner's page renders with their attempt in its first
 * HTML.
 */
function isUnderLearnerPage(pathname: string) {
  return Arr.some(LEARNER_ROUTE_TEMPLATES, (template) =>
    matchesRouteTemplate(`${template}/$`, pathname)
  );
}

/**
 * The assets' answer to a read beneath a learner page that is not a learner's own
 * page: the page or the file that the build wrote. A path with no asset answers
 * nothing here, so the Worker's decisions answer it as they answer any other miss,
 * a retired or moved address and the static not-found page included. A prerender
 * and a development server bind no assets, and every other read follows the
 * assets' own order.
 */
export const readVisitorAsset = Effect.fn("www.routing.learner.asset")(
  function* (request: Request) {
    const { pathname } = new URL(request.url);
    if (
      !hasStaticRelease() ||
      (request.method !== "GET" && request.method !== "HEAD") ||
      !isUnderLearnerPage(pathname) ||
      isLearnerPage(request)
    ) {
      return Option.none<Response>();
    }
    const asset = yield* Effect.promise(() => env.ASSETS.fetch(request));
    if (asset.status !== NOT_FOUND) {
      return Option.some(asset);
    }
    yield* Effect.promise(async () => {
      await asset.body?.cancel();
    });
    return Option.none<Response>();
  }
);
