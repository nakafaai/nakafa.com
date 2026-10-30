import { Effect, Option } from "effect";
import { hasStaticRelease } from "@/lib/routing/release";
import { isBrowserRoutePath } from "@/lib/routing/rendered";
import { answerShell } from "@/lib/routing/shell.server";

/**
 * The browser shell for a read of a page whose route renders only in the browser,
 * such as a learner's home, settings or onboarding, or none. The Worker renders
 * nothing for such a page: the shell's script reads the session hint, sends a
 * visitor to sign-in, and reads the page from Convex. A prerender and a
 * development server bind no release, so their router renders those pages.
 */
export const readBrowserPage = Effect.fn("www.routing.browserPage")(function* (
  request: Request
) {
  if (
    !hasStaticRelease() ||
    (request.method !== "GET" && request.method !== "HEAD") ||
    !isBrowserRoutePath(new URL(request.url))
  ) {
    return Option.none<Response>();
  }
  return Option.some(yield* answerShell(request, 200));
});
